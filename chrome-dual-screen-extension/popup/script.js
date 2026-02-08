document.addEventListener('DOMContentLoaded', () => {
  refreshDisplays();

  document.getElementById('refresh-btn').addEventListener('click', refreshDisplays);
});

function refreshDisplays() {
  const list = document.getElementById('display-list');
  list.innerHTML = '<li>Scanning...</li>';

  // 直接调用 chrome.system.display API
  chrome.system.display.getInfo((displays) => {
    list.innerHTML = '';
    
    if (displays.length === 0) {
      list.innerHTML = '<li>No displays detected.</li>';
      return;
    }

    displays.forEach((display, index) => {
      const li = document.createElement('li');
      const isPrimary = display.isPrimary ? ' (Primary)' : '';
      const mode = display.bounds;
      
      li.innerHTML = `
        <strong>Display ${index + 1}${isPrimary}</strong><br>
        ID: ${display.id}<br>
        Resolution: ${mode.width}x${mode.height}<br>
        Position: (${mode.left}, ${mode.top})
      `;
      list.appendChild(li);
    });
  });
}
