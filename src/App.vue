<script setup>
import { reactive, computed, ref, onMounted, watch } from 'vue'

const game = reactive({
  phase: 'menu', 
  numPlayers: 0,
  players: [],
  rounds: [],
  startTime: null
})

const history = ref([])
const activeTab = ref('table') 

// --- LÓGICA DE PERSISTENCIA ---
const saveCurrentGame = () => {
  if (game.phase === 'playing') {
    localStorage.setItem('pocha_current_backup', JSON.stringify(game))
  }
}

const loadAllData = () => {
  const savedHistory = localStorage.getItem('pocha_history_list')
  if (savedHistory) history.value = JSON.parse(savedHistory)
  const backup = localStorage.getItem('pocha_current_backup')
  if (backup) {
    const data = JSON.parse(backup)
    Object.assign(game, data)
  }
}

watch(() => game.rounds, () => saveCurrentGame(), { deep: true })
onMounted(() => loadAllData())

// --- LÓGICA DE JUEGO ---
// CAMBIO 2: Dealer en minúsculas
const dealerByRound = computed(() => {
  return game.rounds.map((_, roundIndex) => {
    const playerIndex = roundIndex % game.numPlayers
    const name = game.players[playerIndex]?.name
    return name ? name.slice(0, 3).toLowerCase() : '???'
  })
})

const hotPlayers = computed(() => {
  const hotIndices = new Set()
  game.players.forEach((_, pIndex) => {
    let streak = 0
    for (const round of game.rounds) {
      if (round.cards > 1) {
        if (Number(round.scores[pIndex]) === 10) {
          streak++
          if (streak >= 4) hotIndices.add(pIndex)
        } else {
          streak = 0
        }
      }
    }
  })
  return hotIndices
})

function initSetup(n) {
  game.numPlayers = n
  game.players = Array.from({ length: n }, (_, i) => ({ id: i, name: '' }))
  game.phase = 'setup'
}

function startGame() {
  if (game.players.some(p => !p.name.trim())) {
    alert('Todos los jugadores deben tener nombre')
    return
  }
  let maxCards = game.numPlayers === 3 ? 12 : game.numPlayers === 4 ? 9 : game.numPlayers === 5 ? 7 : 6
  const newRounds = []
  for (let i = 0; i < game.numPlayers; i++) {
    // CAMBIO 3: Scores inicializados como null (vacíos) en lugar de 0
    newRounds.push({ cards: 1, scores: Array(game.numPlayers).fill(null) })
  }
  for (let i = 2; i < maxCards; i++) {
    newRounds.push({ cards: i, scores: Array(game.numPlayers).fill(null) })
  }
  for (let i = 0; i < game.numPlayers; i++) {
    newRounds.push({ cards: maxCards, scores: Array(game.numPlayers).fill(null) })
  }
  game.rounds = newRounds
  game.startTime = new Date().toLocaleString('es-ES', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })
  game.phase = 'playing'
  saveCurrentGame()
}

const totals = computed(() => {
  return game.players.map((player, pIndex) => {
    let negativeRounds = 0
    let bestScore = 0
    const playerScores = game.rounds.map(r => Number(r.scores[pIndex]) || 0)
    
    const worstScore = Math.min(...playerScores)
    const worstScoreCount = playerScores.filter(s => s === worstScore).length

    const total = playerScores.reduce((sum, s) => {
      if (s < 0) negativeRounds++
      if (s > bestScore) bestScore = s
      return sum + s
    }, 0)

    const worstStr = worstScoreCount > 0 ? `${worstScore}x${worstScoreCount}` : worstScore

    return { 
      ...player, 
      total, 
      negativeRounds, 
      worstScore, 
      bestScore, 
      worstScoreCount, 
      originalIndex: pIndex,
      statLine: `${negativeRounds} R / ${worstStr} / ${bestScore}`
    }
  })
})

const ranking = computed(() => {
  return [...totals.value].sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total
    if (a.negativeRounds !== b.negativeRounds) return a.negativeRounds - b.negativeRounds
    if (b.worstScore !== a.worstScore) return b.worstScore - a.worstScore
    if (a.worstScoreCount !== b.worstScoreCount) return a.worstScoreCount - b.worstScoreCount
    return b.bestScore - a.bestScore
  })
})

function finishAndSave() {
  if (confirm("¿Finalizar y guardar esta partida en el historial?")) {
    const snapshot = {
      date: game.startTime || new Date().toLocaleString(),
      winner: ranking.value[0]?.name || '---',
      winnerScore: ranking.value[0]?.total || 0,
      players: game.players.map(p => p.name).join(', ')
    }
    history.value.unshift(snapshot)
    if (history.value.length > 10) history.value.pop()
    localStorage.setItem('pocha_history_list', JSON.stringify(history.value))
    exitGame()
  }
}

function finishWithoutSaving() {
  if (confirm("¿Seguro que quieres cerrar la partida? No se guardará en el historial.")) {
    exitGame()
  }
}

function exitGame() {
  localStorage.removeItem('pocha_current_backup')
  game.phase = 'menu'
  game.numPlayers = 0
  game.players = []
  game.rounds = []
  activeTab.value = 'table'
}
</script>

<template>
  <div id="app" :class="{ 'is-playing': game.phase === 'playing' }">
    <header v-if="game.phase !== 'playing'">
      <h1>Pochatronic™ ♠️</h1>
    </header>

    <main v-if="game.phase === 'menu'" class="setup-container">
      <div class="menu-actions">
        <button @click="game.phase = 'setup-players'" class="btn-main-large">🆕 NUEVA PARTIDA</button>
        <button @click="game.phase = 'history'" class="btn-secondary-large">📜 CONSULTAR HISTORIAL</button>
      </div>
      <div v-if="game.rounds.length > 0" class="backup-alert" @click="game.phase = 'playing'">
        <p>📍 Tienes una partida en curso</p>
        <small>Toca aquí para continuarla</small>
      </div>
    </main>

    <main v-else-if="game.phase === 'history'" class="history-container">
      <h2>Últimas 10 Partidas</h2>
      <div v-if="history.length === 0" class="empty-msg">Aún no hay partidas guardadas.</div>
      <div v-for="(h, i) in history" :key="i" class="history-item">
        <div class="h-header">
          <span class="h-date">{{ h.date }}</span>
          <span class="h-score">{{ h.winnerScore }} pts</span>
        </div>
        <div class="h-winner">🏆 Ganador: {{ h.winner }}</div>
        <div class="h-players">{{ h.players }}</div>
      </div>
      <button @click="game.phase = 'menu'" class="btn-back-menu">Volver al inicio</button>
    </main>

    <main v-else-if="game.phase === 'setup-players'" class="setup-container">
      <div class="step">
        <h2>¿Cuántos jugadores?</h2>
        <div class="grid-buttons">
          <button v-for="n in [3, 4, 5, 6]" :key="n" @click="initSetup(n)" class="btn-main">{{ n }}</button>
        </div>
        <button @click="game.phase = 'menu'" class="btn-back">Cancelar</button>
      </div>
    </main>

    <main v-else-if="game.phase === 'setup'" class="setup-container">
      <div class="step">
        <h2>Nombres</h2>
        <div v-for="player in game.players" :key="player.id" class="input-group">
          <input v-model="player.name" :placeholder="'Jugador ' + (player.id + 1)" />
        </div>
        <button @click="startGame" class="btn-start">▶️ Empezar</button>
        <button @click="game.phase = 'setup-players'" class="btn-back">Atrás</button>
      </div>
    </main>

    <main v-else-if="game.phase === 'playing'" class="game-container">
      <div v-show="activeTab === 'table'" class="tab-content">
        <div class="table-wrapper full-screen-table">
          <table class="full-width-table">
            <thead>
              <tr>
                <th colspan="2" class="th-narrow th-sticky-meta">REPARTE</th>
                <th v-for="(p, pIndex) in game.players" :key="p.id" 
                    class="th-player"
                    :class="{ 'is-hot': hotPlayers.has(pIndex) }">
                  {{ p.name.toUpperCase() }}
                  <span v-if="hotPlayers.has(pIndex)">💩</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(round, rIndex) in game.rounds" :key="rIndex">
                <td class="td-cards th-sticky-c">{{ round.cards }}</td>
                <td class="td-dealer th-sticky-d">{{ dealerByRound[rIndex] }}</td>
                <td v-for="(score, pIndex) in round.scores" :key="pIndex" class="td-score">
                  <input type="number" v-model.number="round.scores[pIndex]" 
                         :class="{ 'is-negative': round.scores[pIndex] < 0 }" 
                         placeholder="" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div v-show="activeTab === 'ranking'" class="tab-content ranking-list">
        <h2 class="ranking-title">🏆 Ranking 🏆</h2>
        <div class="ranking-card" v-for="(player, index) in ranking" :key="player.id">
          <div class="rank-pos">{{ index + 1 }}</div>
          <div class="rank-info">
            <span class="rank-name" :class="{ 'name-hot': hotPlayers.has(player.originalIndex) }">
              <span v-if="index === 0">🥇 </span>
              <span v-else-if="index === 1">🥈 </span>
              <span v-else-if="index === 2">🥉 </span>
              <span v-if="index === ranking.length - 1 && index > 2">🏮 </span>
              {{ player.name }}
              <span v-if="hotPlayers.has(player.originalIndex)"> 💩</span>
            </span>
            <span class="rank-details">{{ player.statLine }}</span>
          </div>
          <div class="rank-score">{{ player.total }}</div>
        </div>
        
        <div class="ranking-actions">
          <button @click="finishAndSave" class="btn-reset">🔄 FINALIZAR Y GUARDAR</button>
          <button @click="finishWithoutSaving" class="btn-finish-only">❌ Finalizar sin guardar</button>
        </div>
      </div>

      <nav class="bottom-nav">
        <button :class="{ active: activeTab === 'table' }" @click="activeTab = 'table'">📝 PUNTOS</button>
        <button :class="{ active: activeTab === 'ranking' }" @click="activeTab = 'ranking'">🏆 RANKING</button>
      </nav>
    </main>
  </div>
</template>

<style>
:root {
  --col-cards: 34px;
  --col-dealer: 50px;
  --primary: #2c3e50; --accent: #3498db; --bg: #f4f7f6; --danger: #e74c3c;
  --warning: #f39c12; --nav-height: 70px;
}
body { margin: 0; background: var(--bg); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; -webkit-font-smoothing: antialiased; }
#app.is-playing { padding-bottom: calc(var(--nav-height) + 10px); }

/* CAMBIO 4: Margen 0 arriba si se está jugando */
#app.is-playing header { display: none; }
.ranking-title { text-align: center; color: var(--primary); font-size: 1.1rem; margin-top: 10px; }

header h1 { text-align: center; color: var(--primary); font-size: 1.4rem; margin: 15px 0; letter-spacing: -0.5px; }

/* TABLE SCROLL & STICKY LOGIC */
.table-wrapper { 
  background: white; 
  width: 100%; 
  overflow-x: auto; 
  -webkit-overflow-scrolling: touch; 
}
/* CAMBIO 5: Ajuste máximo a los bordes */
.full-screen-table {
  margin-left: 0;
  margin-right: 0;
}
.full-width-table { 
  width: 100%; 
  border-collapse: separate; 
  border-spacing: 0;
  min-width: 480px; 
}

/* Fijar cabecera REPARTE */
.th-sticky-meta {
  position: sticky;
  left: 0;
  z-index: 12;
  width: calc(var(--col-cards) + var(--col-dealer));
  min-width: calc(var(--col-cards) + var(--col-dealer));
  max-width: calc(var(--col-cards) + var(--col-dealer));
  background: #3e4f5f !important;
  border-right: 2px solid #ccc;
}
/* Fijar columna Cartas */
.th-sticky-c {
  position: sticky;
  left: 0;
  z-index: 6;
  width: var(--col-cards);
  min-width: var(--col-cards);
  max-width: var(--col-cards);
  background: #f8f9fa !important;
  border-right: 1px solid #eee;
}
/* Fijar columna Dealer */
.th-sticky-d {
  position: sticky;
  left: var(--col-cards);
  z-index: 6;
  width: var(--col-dealer);
  min-width: var(--col-dealer);
  max-width: var(--col-dealer);
  background: #f1f3f4 !important;
  border-right: 2px solid #ddd;
}

thead th { position: sticky; top: 0; z-index: 10; }

th { background: var(--primary); color: white; padding: 10px 2px; font-size: 0.65rem; font-weight: 800; }
.th-player { font-size: 0.75rem; min-width: 65px; }
.td-score {
  min-width: 65px;
}
th.is-hot { background-color: var(--warning) !important; color: white; }

td { border-bottom: 1px solid #eee; padding: 8px 0; text-align: center; background: white; }
.td-cards { font-weight: bold; font-size: 0.8rem; }
.td-dealer { font-size: 0.7rem; color: #666; font-weight: bold; }

input[type=number] { 
  width: 48px; 
  height: 38px; 
  border: 1px solid #dcdde1; 
  border-radius: 6px; 
  text-align: center; 
  font-size: 1.1rem; 
}
input.is-negative { background: #fee2e2; color: var(--danger); border-color: #fca5a5; font-weight: bold; }

/* RANKING ACTIONS */
.ranking-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 20px;
  padding-bottom: 30px;
}
.btn-reset { width: 90%; padding: 15px; background: #fff; color: var(--danger); border: 2px solid var(--danger); border-radius: 10px; font-weight: bold; margin-bottom: 12px; }
.btn-finish-only { background: transparent; border: none; color: #888; text-decoration: underline; font-size: 0.9rem; padding: 10px; }

/* ESTILOS ORIGINALES MANTENIDOS */
.setup-container { padding: 20px; text-align: center; max-width: 400px; margin: 0 auto; }
.grid-buttons { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 20px; }
.btn-main { padding: 25px; font-size: 1.3rem; background: white; border: 2px solid var(--accent); border-radius: 12px; color: var(--accent); font-weight: bold; }
.btn-main-large { padding: 30px; font-size: 1.2rem; background: var(--accent); color: white; border: none; border-radius: 15px; font-weight: 800; width: 100%; margin-bottom: 10px; }
.btn-secondary-large { padding: 20px; font-size: 1rem; background: white; color: var(--primary); border: 2px solid var(--primary); border-radius: 15px; font-weight: 700; width: 100%; }
.backup-alert { margin-top: 40px; background: #fff3cd; border: 1px solid #ffeeba; padding: 15px; border-radius: 12px; color: #856404; }
.history-container { padding: 10px; max-width: 92%; margin: 0 auto; }
.history-item { background: white; padding: 15px; border-radius: 12px; margin-bottom: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
.h-header { display: flex; justify-content: space-between; font-size: 0.8rem; color: #888; }
.h-winner { font-weight: bold; color: var(--primary); font-size: 1.1rem; }
.btn-back-menu { width: 100%; padding: 15px; margin-top: 20px; background: var(--primary); color: white; border: none; border-radius: 10px; font-weight: bold; }
.input-group input { width: 90%; padding: 12px; margin: 8px 0; border-radius: 8px; border: 1px solid #ccc; font-size: 1rem; }
.btn-start { background: var(--accent); color: white; width: 100%; padding: 15px; margin-top: 20px; border: none; border-radius: 8px; font-weight: bold; }
.btn-back { background: transparent; color: #666; width: 100%; padding: 10px; border: none; }
.ranking-list { padding: 10px; max-width: 92%; margin: 0 auto; }
.ranking-card { display: flex; align-items: center; background: white; margin-bottom: 12px; padding: 15px; border-radius: 15px; }
.rank-pos { font-size: 1.3rem; font-weight: 800; width: 40px; color: var(--accent); }
.rank-info { flex-grow: 1; display: flex; flex-direction: column; }
.rank-name { font-weight: 700; font-size: 1.1rem; color: var(--primary); }
.rank-details { font-size: 0.75rem; color: #999; font-weight: 600; text-transform: uppercase; }
.rank-score { font-size: 1.6rem; font-weight: 800; text-align: right; min-width: 50px; }
.bottom-nav { position: fixed; bottom: 0; left: 0; right: 0; display: flex; background: white; border-top: 1px solid #ddd; height: var(--nav-height); z-index: 9999; }
.bottom-nav button { flex: 1; border: none; background: none; font-weight: 800; color: #aaa; }
.bottom-nav button.active { color: var(--accent); background: #f0f9ff; box-shadow: inset 0 4px 0 var(--accent); }
</style>