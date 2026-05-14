document.addEventListener('DOMContentLoaded', () => {
    // Basic RTOS logic to make the dashboard look alive
    const tbody = document.getElementById('task-tbody');
    const qReady = document.getElementById('ready-queue');
    const term = document.getElementById('terminal-output');
    
    let isRunning = false;
    let tick = 0;

    function logTerm(msg) {
        term.innerHTML += `<div class="t-log info">>> ${msg}</div>`;
        term.scrollTop = term.scrollHeight;
    }

    // Populate Tasks
    const tasks = [
        {pid: 101, name: 'SysIdle', pri: 0, mem: '12KB', at: 0, bt: '-', state: 'RUNNING'},
        {pid: 102, name: 'SensorRead', pri: 5, mem: '24KB', at: 2, bt: 15, state: 'READY'},
        {pid: 103, name: 'Telemetry', pri: 3, mem: '64KB', at: 5, bt: 40, state: 'READY'},
        {pid: 104, name: 'DisplayUI', pri: 2, mem: '128KB', at: 10, bt: 25, state: 'WAITING'}
    ];

    function renderTasks() {
        tbody.innerHTML = '';
        qReady.innerHTML = '';
        tasks.forEach(t => {
            tbody.innerHTML += `<tr>
                <td>${t.pid}</td><td>${t.name}</td><td>${t.pri}</td><td>${t.mem}</td>
                <td>${t.at}</td><td>${t.bt}</td><td>0</td><td>0</td><td>0</td><td>0</td>
                <td class="${t.state==='RUNNING'?'text-neon-blue':(t.state==='READY'?'text-cyan':'text-warning-yellow')}">${t.state}</td>
            </tr>`;
            if (t.state === 'READY') {
                qReady.innerHTML += `<div class="q-block">P${t.pid}</div>`;
            }
        });
    }

    // Clock
    setInterval(() => {
        document.getElementById('system-clock').innerText = new Date().toLocaleTimeString();
    }, 1000);

    // Simulation Loop
    setInterval(() => {
        if (!isRunning) return;
        tick += 10;
        document.getElementById('header-tick').innerText = tick;
        document.getElementById('tick-counter').innerText = tick;

        if (tick % 100 === 0) {
            document.getElementById('core1-load').innerText = Math.floor(Math.random()*80 + 20) + '%';
            document.getElementById('core2-load').innerText = Math.floor(Math.random()*60 + 10) + '%';
        }
    }, 100);

    // Buttons
    document.getElementById('btn-start').addEventListener('click', () => { 
        isRunning = true; logTerm("Scheduler Started."); 
        document.getElementById('core0-task').innerText = 'P101';
        document.getElementById('core1-task').innerText = 'P102';
        document.getElementById('core0-status').innerText = 'RUNNING';
        document.getElementById('core1-status').innerText = 'RUNNING';
    });
    document.getElementById('btn-stop').addEventListener('click', () => { 
        isRunning = false; logTerm("Scheduler Stopped."); 
        document.getElementById('core0-task').innerText = 'IDLE';
        document.getElementById('core1-task').innerText = 'IDLE';
        document.getElementById('core0-status').innerText = 'IDLE';
        document.getElementById('core1-status').innerText = 'IDLE';
    });
    document.getElementById('btn-reset').addEventListener('click', () => { 
        isRunning = false; tick = 0; logTerm("System Reset."); 
        document.getElementById('header-tick').innerText = '0';
        document.getElementById('tick-counter').innerText = '0';
    });

    // Heap Visual
    let heapHtml = '';
    for(let i=0; i<40; i++) heapHtml += `<div class="heap-cell" style="opacity: ${Math.random()>0.5?1:0.1}"></div>`;
    document.getElementById('heap-visual').innerHTML = heapHtml;

    // Charts (Dummy)
    const ctxCpu = document.getElementById('cpuChart').getContext('2d');
    new Chart(ctxCpu, {
        type: 'line', data: { labels: ['1','2','3','4','5'], datasets: [{ label:'CPU', data:[10,25,20,40,30], borderColor: '#00e5ff' }] },
        options: { responsive: true, maintainAspectRatio: false, plugins:{legend:{display:false}} }
    });

    const ctxRam = document.getElementById('ramChart').getContext('2d');
    new Chart(ctxRam, {
        type: 'bar', data: { labels: ['Used','Free'], datasets: [{ label:'RAM', data:[45, 55], backgroundColor: ['#9d00ff', '#00ffcc'] }] },
        options: { responsive: true, maintainAspectRatio: false, plugins:{legend:{display:false}} }
    });

    renderTasks();
    logTerm("Micro-RTOS Initialized.");
});
