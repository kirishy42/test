/**
 * 戦略カードゲーム - UI & 進行管理 (Online Simulation)
 */

class GameController {
    constructor() {
        this.players = [];
        this.round = 1;
        this.centerCards = [];
        this.deck = [];
        this.timer = 60;
        this.timerInterval = null;
        this.matchingTimeout = null;
        this.playedCount = 0;
        this.audioCtx = null;
        this.bgm = document.getElementById('bgm');

        if (this.bgm) this.bgm.volume = 0.15;
    }

    playSE(type) {
        if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const ctx = this.audioCtx;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === 'select') {
            osc.type = 'sine'; osc.frequency.setValueAtTime(440, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            osc.start(); osc.stop(ctx.currentTime + 0.1);
        } else if (type === 'resolve') {
            osc.type = 'square'; osc.frequency.setValueAtTime(220, ctx.currentTime);
            gain.gain.setValueAtTime(0.05, ctx.currentTime); osc.start(); osc.stop(ctx.currentTime + 0.2);
        } else if (type === 'match') {
            osc.type = 'triangle'; osc.frequency.setValueAtTime(523, ctx.currentTime);
            gain.gain.setValueAtTime(0.1, ctx.currentTime); osc.start(); osc.stop(ctx.currentTime + 0.3);
        }
    }

    tryLogin() {
        const usernameInput = document.getElementById('username-input');
        const passwordInput = document.getElementById('password-input');
        const username = usernameInput ? usernameInput.value.trim() : "";
        const password = passwordInput ? passwordInput.value : "";

        if (!username) { alert("名乗る名を入力してくれ。"); return; }
        if (password !== "456123") { alert("合言葉が違うようだ。"); return; }

        this.players = [{ id: 0, name: username, isHuman: true, hand: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], inventory: [] }];
        this.startMatching();
    }

    startMatching() {
        this.playSE('select');
        this.switchTo('matching-screen');
        const listEl = document.getElementById('matched-players');
        const countEl = document.getElementById('matching-count');

        listEl.innerHTML = `<div class="chip">${this.players[0].name} (あなた)</div>`;
        const names = ["信長", "秀吉", "家康", "幸村", "政宗", "謙信", "信玄"];
        const targetCount = 3 + Math.floor(Math.random() * 3);
        let currentCount = 1;

        // マッチングタイムアウト設定 (60秒待機後のCPU強制投入)
        const matchStartTime = Date.now();

        const addPlayer = () => {
            const elapsed = (Date.now() - matchStartTime) / 1000;

            // 60秒経過、または目標人数に達するまで
            if (currentCount < targetCount && elapsed < 60) {
                currentCount++;
                const name = names.splice(Math.floor(Math.random() * names.length), 1)[0] + "(AI)";
                this.players.push({ id: currentCount - 1, name: name, isHuman: false, hand: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], inventory: [] });
                this.playSE('match');
                countEl.textContent = `現在 ${currentCount}/${targetCount} 名待機中...`;
                const chip = document.createElement('div');
                chip.className = 'chip'; chip.textContent = name;
                listEl.appendChild(chip);

                // 次のプレイヤーまでの待機をシミュレート (0.5秒〜5秒のランダム)
                this.matchingTimeout = setTimeout(addPlayer, 500 + Math.random() * 4500);
            } else {
                // 目標人数に達した、あるいは60秒経過
                if (currentCount < 3) { // 最低3人は確保
                    while (currentCount < 3) {
                        currentCount++;
                        const name = names.splice(0, 1)[0] + "(AI)";
                        this.players.push({ id: currentCount - 1, name: name, isHuman: false, hand: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], inventory: [] });
                    }
                }
                countEl.textContent = "マッチング完了！";
                setTimeout(() => this.goToCharSelection(), 1000);
            }
        };
        this.matchingTimeout = setTimeout(addPlayer, 1000);
    }

    goToCharSelection() {
        this.players.forEach(p => {
            p.hand = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
            p.inventory = [];
            p.selectedValue = null;
            p.hasPlayed = false;
        });
        this.switchTo('char-selection-screen');
        this.renderCharOptions();
        this.players.forEach(p => {
            if (!p.isHuman) p.character = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
        });
        if (this.bgm) this.bgm.play().catch(() => { });
    }

    renderCharOptions() {
        const container = document.getElementById('char-options');
        container.innerHTML = '';
        const pool = [...CHARACTERS].sort(() => Math.random() - 0.5);
        pool.slice(0, 2).forEach(char => {
            const card = document.createElement('div');
            card.className = 'card character';
            card.innerHTML = `<img src="${char.img}"><div class="info-box"><div class="name">${char.name}</div></div>`;
            card.onclick = () => this.selectCharacter(char);
            container.appendChild(card);
        });
    }

    selectCharacter(char) {
        this.playSE('select');
        this.players[0].character = char;
        this.switchTo('main-game-screen');
        this.setupBoard();
        this.startRound();
    }

    setupBoard() {
        this.deck = [];
        for (let i = 0; i < 15; i++) for (let v = 1; v <= 7; v++) this.deck.push(v);
        this.deck.sort(() => Math.random() - 0.5);

        const bar = document.getElementById('opponents-bar');
        bar.innerHTML = '';
        this.players.forEach(p => {
            if (!p.isHuman) {
                const el = document.createElement('div');
                el.className = 'opponent-stat'; el.id = `player-stat-${p.id}`;
                el.innerHTML = `<div class="avatar">${p.name[0]}</div><div class="status">獲得: 0枚</div><div class="status card-count">🃏 10</div>`;
                bar.appendChild(el);
            }
        });

        const char = this.players[0].character;
        document.getElementById('my-character-card').innerHTML = `<div class="card character"><img src="${char.img}"><div class="info-box"><div class="name">${char.name}</div></div></div>`;
        document.getElementById('panel-effect-text').textContent = char.effect;
    }

    startRound() {
        if (this.round > 10) { this.showResults(); return; }
        this.playedCount = 0;
        this.players.forEach(p => { p.hasPlayed = false; p.selectedValue = null; });
        document.getElementById('current-round').textContent = this.round;
        this.centerCards = this.deck.splice(0, this.players.length);
        this.renderField();
        this.renderHand();
        this.startTimer();
        this.simulateAIPlays();
    }

    renderField() {
        const grid = document.getElementById('reward-slots');
        grid.innerHTML = '';
        this.centerCards.forEach((val, i) => {
            const slot = document.createElement('div');
            slot.className = 'reward-slot';
            slot.innerHTML = `<div class="acquirer-name" id="acquirer-${i}">?</div><div class="card"><div class="number">${val}</div></div>`;
            grid.appendChild(slot);
        });
    }

    renderHand() {
        const container = document.getElementById('my-hand');
        container.innerHTML = '';
        this.players[0].hand.sort((a, b) => a - b).forEach(v => {
            const card = document.createElement('div');
            card.className = 'card';
            if (this.players[0].hasPlayed) card.classList.add('face-down');
            card.innerHTML = `<div class="number">${v}</div>`;
            card.onclick = () => !this.players[0].hasPlayed && this.playCard(v);
            container.appendChild(card);
        });
    }

    startTimer() {
        this.timer = 60;
        const el = document.getElementById('timer-sec');
        el.textContent = this.timer; el.parentElement.classList.remove('low');
        if (this.timerInterval) clearInterval(this.timerInterval);
        this.timerInterval = setInterval(() => {
            this.timer--; el.textContent = this.timer;
            if (this.timer <= 10) el.parentElement.classList.add('low');
            if (this.timer <= 0) { clearInterval(this.timerInterval); if (!this.players[0].hasPlayed) this.autoPlay(); }
        }, 1000);
    }

    playCard(val) {
        this.playSE('select');
        const p = this.players[0];
        p.selectedValue = val;
        p.hand = p.hand.filter(v => v !== val);
        p.hasPlayed = true; this.playedCount++;
        this.renderHand(); this.checkAllPlayed();
    }

    autoPlay() {
        const p = this.players[0];
        const val = p.hand[Math.floor(Math.random() * p.hand.length)];
        this.playCard(val);
    }

    simulateAIPlays() {
        this.players.forEach(p => {
            if (!p.isHuman) {
                setTimeout(() => {
                    if (this.round > 10) return;
                    const idx = Math.floor(Math.random() * p.hand.length);
                    p.selectedValue = p.hand.splice(idx, 1)[0];
                    p.hasPlayed = true; this.playedCount++;
                    this.updateOpponentStatus(p);
                    this.checkAllPlayed();
                }, 1000 + Math.random() * 8000);
            }
        });
    }

    updateOpponentStatus(p) {
        const el = document.getElementById(`player-stat-${p.id}`);
        if (el) { el.classList.add('has-played'); el.querySelector('.card-count').textContent = `🃏 ${p.hand.length}`; }
    }

    checkAllPlayed() {
        if (this.playedCount === this.players.length) {
            clearInterval(this.timerInterval);
            setTimeout(() => this.resolveRound(), 1000);
        }
    }

    async resolveRound() {
        this.playSE('resolve');
        const bids = this.players.map(p => ({ playerId: p.id, value: p.selectedValue }));
        const allocations = resolveBidding(bids, this.centerCards);
        const sortedRewards = [...this.centerCards].sort((a, b) => b - a);
        const valueCounts = {};
        bids.forEach(b => { valueCounts[b.value] = (valueCounts[b.value] || 0) + 1; });
        const validBids = bids.filter(b => valueCounts[b.value] === 1).sort((a, b) => b.value - a.value);

        const animPromises = [];
        validBids.forEach((bid, i) => {
            if (i < sortedRewards.length) {
                const player = this.players.find(p => p.id === bid.playerId);
                const slotIdx = this.centerCards.indexOf(sortedRewards[i]);
                animPromises.push(this.flyCard(slotIdx, player));
                player.inventory.push(sortedRewards[i]);
            }
        });

        await Promise.all(animPromises);
        document.querySelectorAll('.opponent-stat').forEach(el => el.classList.remove('has-played'));
        setTimeout(() => { this.round++; this.updateInventoryUI(); this.startRound(); }, 1500);
    }

    flyCard(slotIdx, player) {
        return new Promise(resolve => {
            const slots = document.querySelectorAll('.reward-slot');
            const slot = slots[slotIdx];
            const cardEl = slot.querySelector('.card');
            const rect = cardEl.getBoundingClientRect();
            const flyer = cardEl.cloneNode(true);
            flyer.classList.add('animating-card');
            flyer.style.left = rect.left + 'px'; flyer.style.top = rect.top + 'px';
            flyer.style.width = rect.width + 'px'; flyer.style.height = rect.height + 'px';
            document.body.appendChild(flyer);
            cardEl.style.visibility = 'hidden';
            document.getElementById(`acquirer-${slotIdx}`).textContent = player.name;

            const targetRect = player.isHuman
                ? document.getElementById('my-inventory-count').getBoundingClientRect()
                : document.getElementById(`player-stat-${player.id}`).getBoundingClientRect();

            setTimeout(() => {
                flyer.style.left = (targetRect.left + targetRect.width / 2 - 20) + 'px';
                flyer.style.top = (targetRect.top + targetRect.height / 2 - 20) + 'px';
                flyer.style.transform = 'scale(0.2)'; flyer.style.opacity = '0';
            }, 50);
            setTimeout(() => { flyer.remove(); resolve(); }, 850);
        });
    }

    updateInventoryUI() {
        const p = this.players[0];
        if (p) {
            document.getElementById('my-inventory-count').textContent = p.inventory.length;
            document.getElementById('my-inventory-list').innerHTML = p.inventory.map(v => `<div class="mini-card">${v}</div>`).join('');
        }
        this.players.forEach(p => {
            if (!p.isHuman) {
                const el = document.getElementById(`player-stat-${p.id}`);
                if (el) el.querySelector('.status').textContent = `獲得: ${p.inventory.length}枚`;
            }
        });
    }

    showResults() {
        this.switchTo('result-screen');
        const container = document.getElementById('final-results'); container.innerHTML = '';
        const results = this.players.map(p => {
            const res = calculateFinalScore(p.inventory, p.character, this.players);
            return { ...p, score: res.score, isSpecial: res.isSpecialWin };
        });
        results.sort((a, b) => (b.isSpecial ? Infinity : b.score) - (a.isSpecial ? Infinity : a.score));
        const winner = results[0];
        document.getElementById('winner-announcement').textContent = `${winner.name} の勝利！`;
        results.forEach(res => {
            const row = document.createElement('div');
            row.className = `result-row ${res.id === winner.id ? 'winner' : ''}`;
            const sText = res.isSpecial ? "特 殊 勝 利" : `${res.score}点`;
            row.innerHTML = `<div class="char-thumb"><img src="${res.character.img}" width="50" height="70"></div><div style="padding:0 20px; text-align:left"><strong>${res.name}</strong><br><small>${res.character.effect}</small></div><div class="score">${sText}</div>`;
            container.appendChild(row);
        });
    }

    switchTo(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(screenId).classList.add('active');
    }
}

const game = new GameController();
window.game = game;
