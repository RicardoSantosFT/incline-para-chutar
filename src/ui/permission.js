// Aviso de sensor bloqueado. O iOS rejeita o pedido sem mostrar prompt quando
// a página roda embutida (iframe de outra origem, ex. visualizador de
// artifacts, ou webview de app) — explicamos o motivo em vez de falhar mudo.
const isEmbedded = (() => {
  try {
    return window.top !== window
  } catch {
    return true
  }
})()

export function showPermissionBlocked(permissionError) {
  const errorBox = document.getElementById('perm-error')
  const detail = permissionError ? `<br /><small>Detalhe técnico: ${permissionError}</small>` : ''
  errorBox.innerHTML = isEmbedded
    ? '<b>O pedido foi bloqueado pelo iPhone.</b> O jogo está rodando embutido dentro de outra página, e nesse caso o iOS não mostra o pedido de sensor. Abra o jogo direto no Safari (página própria, fora de apps) para inclinar de verdade — ou jogue aqui no modo toque.' + detail
    : '<b>O pedido foi bloqueado.</b> Se você negou antes: no Safari, toque em <b>aA</b> na barra de endereço → Configurações do Site → ative <b>Movimento e Orientação</b> e tente de novo. Se estiver usando o navegador de dentro de um app (Instagram, Claude etc.), abra o link no Safari.' + detail
  errorBox.hidden = false
  document.querySelector('#btn-grant b').textContent = 'Tentar de novo'
}
