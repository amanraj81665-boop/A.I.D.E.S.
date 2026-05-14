document.addEventListener('DOMContentLoaded', () => {
    // ---------------- Configuration & State ----------------
    const numProcesses = 5;
    const numResources = 3;
    
    let allocation = [];
    let max = [];
    let need = [];
    let available = [];

    // ---------------- UI Elements ----------------
    const allocWrapper = document.getElementById('alloc-wrapper');
    const maxWrapper = document.getElementById('max-wrapper');
    const needWrapper = document.getElementById('need-wrapper');
    const availWrapper = document.getElementById('avail-wrapper');
    const reqWrapper = document.getElementById('req-wrapper');
    const btnRandomize = document.getElementById('btn-randomize');
    const btnCalculate = document.getElementById('btn-calculate');
    const btnRequest = document.getElementById('btn-request');
    const btnKill = document.getElementById('btn-kill');
    const reqProcessSelect = document.getElementById('req-process-select');
    const killProcessSelect = document.getElementById('kill-process-select');
    const sequenceFlow = document.getElementById('safe-sequence-flow');
    const stateBadge = document.getElementById('state-badge');
    const deadlockAlert = document.getElementById('deadlock-alert');
    const deadlockedProcsSpan = document.getElementById('deadlocked-procs');
    const terminalOutput = document.getElementById('terminal-output');
    const traceToggle = document.getElementById('trace-toggle');
    
    // Create Tooltip Element
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    document.body.appendChild(tooltip);

    // ---------------- Clock & Init ----------------
    setInterval(() => {
        const now = new Date();
        document.getElementById('clock').innerText = now.toLocaleTimeString('en-US', {hour12:false}) + '.' + Math.floor(now.getMilliseconds()/100);
    }, 100);

    function logTerminal(msg, type='info') {
        const div = document.createElement('div');
        div.className = `log-line ${type}`;
        div.innerText = `[${new Date().toLocaleTimeString('en-US', {hour12:false})}] ${msg}`;
        terminalOutput.appendChild(div);
        terminalOutput.scrollTop = terminalOutput.scrollHeight;
    }

    // ---------------- Matrix Initialization ----------------
    function createMatrixTable(wrapper, rows, cols, isReadonly=false, idPrefix='') {
        let table = '<table><thead><tr><th>Proc</th>';
        for (let j=0; j<cols; j++) table += `<th>R${j}</th>`;
        table += '</tr></thead><tbody>';
        
        for (let i=0; i<rows; i++) {
            table += `<tr id="row_${idPrefix}_${i}"><th>P${i}</th>`;
            for (let j=0; j<cols; j++) {
                if (isReadonly) {
                    table += `<td class="readonly" id="${idPrefix}_${i}_${j}">0</td>`;
                } else {
                    table += `<td><input type="number" min="0" id="${idPrefix}_${i}_${j}" value="0"></td>`;
                }
            }
            table += '</tr>';
        }
        table += '</tbody></table>';
        wrapper.innerHTML = table;
    }

    function createAvailInputs() {
        let html = '';
        let reqHtml = '';
        for (let j=0; j<numResources; j++) {
            html += `<div class="avail-item"><span>R${j}</span><input type="number" min="0" id="avail_${j}" value="0"></div>`;
            reqHtml += `<div class="req-item"><span>R${j}</span><input type="number" min="0" id="req_${j}" value="0"></div>`;
        }
        availWrapper.innerHTML = html;
        reqWrapper.innerHTML = reqHtml;
    }

    function initUI() {
        createMatrixTable(allocWrapper, numProcesses, numResources, false, 'alloc');
        createMatrixTable(maxWrapper, numProcesses, numResources, false, 'max');
        createMatrixTable(needWrapper, numProcesses, numResources, true, 'need');
        createAvailInputs();
        setupInputListeners();
        randomizeData(); // Populate with initial random safe state
        drawRAG();
        initCharts();
    }

    // ---------------- Data Handling ----------------
    function setupInputListeners() {
        const inputs = document.querySelectorAll('.matrix-container input, .available-section input');
        inputs.forEach(input => {
            input.addEventListener('input', () => {
                if (input.value === '' || input.value < 0) input.value = 0;
                updateNeedMatrix();
            });
        });
    }

    function randomizeData() {
        const allocData = [[0, 1, 0],[2, 0, 0],[3, 0, 2],[2, 1, 1],[0, 0, 2]];
        const maxData = [[7, 5, 3],[3, 2, 2],[9, 0, 2],[2, 2, 2],[4, 3, 3]];
        const availData = [3, 3, 2];
        const useFixed = Math.random() > 0.3; 

        for (let i=0; i<numProcesses; i++) {
            for (let j=0; j<numResources; j++) {
                let a = useFixed ? allocData[i][j] : Math.floor(Math.random() * 3);
                let m = useFixed ? maxData[i][j] : a + Math.floor(Math.random() * 5);
                document.getElementById(`alloc_${i}_${j}`).value = a;
                document.getElementById(`max_${i}_${j}`).value = m;
            }
        }
        for (let j=0; j<numResources; j++) {
            document.getElementById(`avail_${j}`).value = useFixed ? availData[j] : Math.floor(Math.random() * 4);
            document.getElementById(`req_${j}`).value = 0;
        }
        
        updateNeedMatrix();
        resetUIState();
        logTerminal('Matrices randomized.', 'info');
        drawRAG();
    }

    function updateNeedMatrix() {
        for (let i=0; i<numProcesses; i++) {
            for (let j=0; j<numResources; j++) {
                let a = parseInt(document.getElementById(`alloc_${i}_${j}`).value) || 0;
                let m = parseInt(document.getElementById(`max_${i}_${j}`).value) || 0;
                let n = m - a;
                if (n < 0) n = 0; 
                document.getElementById(`need_${i}_${j}`).innerText = n;
            }
        }
    }

    function readMatrices() {
        allocation = []; max = []; need = []; available = [];
        for (let i=0; i<numProcesses; i++) {
            let aRow = [], mRow = [], nRow = [];
            for (let j=0; j<numResources; j++) {
                let a = parseInt(document.getElementById(`alloc_${i}_${j}`).value) || 0;
                let m = parseInt(document.getElementById(`max_${i}_${j}`).value) || 0;
                aRow.push(a); mRow.push(m); nRow.push(m - a > 0 ? m - a : 0);
            }
            allocation.push(aRow); max.push(mRow); need.push(nRow);
        }
        for (let j=0; j<numResources; j++) {
            available.push(parseInt(document.getElementById(`avail_${j}`).value) || 0);
        }
    }

    function resetUIState() {
        stateBadge.className = 'badge neutral';
        stateBadge.innerText = 'PENDING';
        sequenceFlow.innerHTML = '<div class="placeholder-text">Run algorithm to detect safe state...</div>';
        deadlockAlert.classList.add('hidden');
        document.querySelectorAll('tr').forEach(tr => tr.classList.remove('trace-highlight'));
    }

    // ---------------- Banker's Safety Algorithm ----------------
    btnRandomize.addEventListener('click', randomizeData);
    btnCalculate.addEventListener('click', () => {
        readMatrices();
        if (traceToggle.checked) {
            runBankersTrace();
        } else {
            runBankersAlgorithm();
        }
    });

    function runBankersAlgorithm(isSilent = false) {
        if(!isSilent) logTerminal('Running Safety Algorithm...', 'info');
        
        let work = [...available];
        let finish = new Array(numProcesses).fill(false);
        let safeSequence = [];
        let count = 0;

        while (count < numProcesses) {
            let found = false;
            for (let i=0; i<numProcesses; i++) {
                if (!finish[i]) {
                    let canAllocate = true;
                    for (let j=0; j<numResources; j++) {
                        if (need[i][j] > work[j]) { canAllocate = false; break; }
                    }
                    if (canAllocate) {
                        for (let j=0; j<numResources; j++) work[j] += allocation[i][j];
                        safeSequence.push(i);
                        finish[i] = true;
                        found = true;
                        count++;
                    }
                }
            }
            if (!found) break; // Unsafe
        }

        const isSafe = count === numProcesses;
        if (!isSilent) {
            renderResult(isSafe, safeSequence, finish);
            drawRAG();
            updateCharts();
        }
        return isSafe;
    }

    // Advanced: Trace Mode
    async function runBankersTrace() {
        logTerminal('Starting Trace Mode...', 'info');
        resetUIState();
        
        let work = [...available];
        let finish = new Array(numProcesses).fill(false);
        let safeSequence = [];
        let count = 0;

        const sleep = ms => new Promise(r => setTimeout(r, ms));

        while (count < numProcesses) {
            let found = false;
            for (let i=0; i<numProcesses; i++) {
                if (!finish[i]) {
                    // Highlight row
                    document.querySelectorAll('tr').forEach(tr => tr.classList.remove('trace-highlight'));
                    document.getElementById(`row_need_${i}`).classList.add('trace-highlight');
                    
                    let canAllocate = true;
                    for (let j=0; j<numResources; j++) {
                        if (need[i][j] > work[j]) { canAllocate = false; break; }
                    }

                    if (canAllocate) {
                        logTerminal(`P${i} Need [${need[i]}] <= Work [${work}] -> Granted!`, 'trace-log');
                        for (let j=0; j<numResources; j++) work[j] += allocation[i][j];
                        safeSequence.push(i);
                        finish[i] = true;
                        found = true;
                        count++;
                        logTerminal(`New Work = [${work}]`, 'trace-log');
                        
                        // Add to sequence visually
                        const node = document.createElement('div');
                        node.className = 'seq-node';
                        node.innerText = `P${i}`;
                        if(sequenceFlow.querySelector('.placeholder-text')) sequenceFlow.innerHTML = '';
                        sequenceFlow.appendChild(node);
                        const arrow = document.createElement('div');
                        arrow.className = 'seq-arrow';
                        arrow.innerHTML = '<i class="fa-solid fa-arrow-right"></i>';
                        sequenceFlow.appendChild(arrow);

                        await sleep(1000);
                    } else {
                        logTerminal(`P${i} Need [${need[i]}] > Work [${work}] -> Skipped.`, 'warning');
                        await sleep(500);
                    }
                }
            }
            if (!found) break; // Unsafe
        }

        document.querySelectorAll('tr').forEach(tr => tr.classList.remove('trace-highlight'));
        
        const isSafe = count === numProcesses;
        renderResult(isSafe, safeSequence, finish);
        drawRAG();
        updateCharts();
    }

    // ---------------- Advanced: Resource Request Algorithm ----------------
    btnRequest.addEventListener('click', handleResourceRequest);

    function handleResourceRequest() {
        readMatrices();
        const pId = parseInt(reqProcessSelect.value);
        let request = [];
        for (let j=0; j<numResources; j++) {
            request.push(parseInt(document.getElementById(`req_${j}`).value) || 0);
        }

        logTerminal(`Received dynamic request from P${pId}: [${request.join(', ')}]`, 'info');

        // Step 1: Check Request <= Need
        for (let j=0; j<numResources; j++) {
            if (request[j] > need[pId][j]) {
                logTerminal(`Error: P${pId} requested more than max need!`, 'error');
                return;
            }
        }

        // Step 2: Check Request <= Available
        for (let j=0; j<numResources; j++) {
            if (request[j] > available[j]) {
                logTerminal(`Error: P${pId} must wait, resources not available.`, 'warning');
                return;
            }
        }

        // Step 3: Pretend to allocate
        for (let j=0; j<numResources; j++) {
            available[j] -= request[j];
            allocation[pId][j] += request[j];
            need[pId][j] -= request[j];
        }

        // Check if Safe
        logTerminal(`Pretending to allocate... Checking safety.`, 'info');
        const isSafe = runBankersAlgorithm(true);

        if (isSafe) {
            logTerminal(`State is SAFE. Request granted to P${pId}!`, 'success');
            // Write back to UI
            for (let j=0; j<numResources; j++) {
                document.getElementById(`avail_${j}`).value = available[j];
                document.getElementById(`alloc_${pId}_${j}`).value = allocation[pId][j];
            }
            updateNeedMatrix();
            runBankersAlgorithm(false); // Update full UI
        } else {
            logTerminal(`UNSAFE STATE! Request denied. Rolling back.`, 'error');
            // Rollback is automatic since we didn't write to UI yet, just re-read matrices
            readMatrices(); 
        }
    }

    // ---------------- Advanced: Deadlock Recovery ----------------
    btnKill.addEventListener('click', () => {
        const pId = parseInt(killProcessSelect.value);
        logTerminal(`EXECUTING RECOVERY: Terminating P${pId}...`, 'error');
        
        // Free resources to Available
        for(let j=0; j<numResources; j++) {
            let allocVal = parseInt(document.getElementById(`alloc_${pId}_${j}`).value) || 0;
            let availVal = parseInt(document.getElementById(`avail_${j}`).value) || 0;
            
            document.getElementById(`avail_${j}`).value = availVal + allocVal;
            
            // Zero out process
            document.getElementById(`alloc_${pId}_${j}`).value = 0;
            document.getElementById(`max_${pId}_${j}`).value = 0;
            document.getElementById(`need_${pId}_${j}`).innerText = 0;
        }

        logTerminal(`P${pId} resources freed. Re-running Banker's Algorithm.`, 'info');
        runBankersAlgorithm();
    });

    // ---------------- Rendering Results ----------------
    function renderResult(isSafe, safeSequence, finish) {
        if (!traceToggle.checked) sequenceFlow.innerHTML = '';
        else {
            // Cleanup arrows at end of trace
            let lastChild = sequenceFlow.lastChild;
            if(lastChild && lastChild.className === 'seq-arrow') sequenceFlow.removeChild(lastChild);
        }

        if (isSafe) {
            stateBadge.className = 'badge safe';
            stateBadge.innerText = 'SAFE STATE';
            deadlockAlert.classList.add('hidden');
            if(!traceToggle.checked) logTerminal(`System is SAFE. Sequence found.`, 'success');

            if(!traceToggle.checked) {
                safeSequence.forEach((p, index) => {
                    setTimeout(() => {
                        const node = document.createElement('div');
                        node.className = 'seq-node';
                        node.innerText = `P${p}`;
                        sequenceFlow.appendChild(node);
                        if (index < safeSequence.length - 1) {
                            const arrow = document.createElement('div');
                            arrow.className = 'seq-arrow';
                            arrow.innerHTML = '<i class="fa-solid fa-arrow-right"></i>';
                            sequenceFlow.appendChild(arrow);
                        }
                    }, index * 400);
                });
            }
        } else {
            stateBadge.className = 'badge unsafe';
            stateBadge.innerText = 'UNSAFE / DEADLOCK';
            
            let deadlocked = [];
            killProcessSelect.innerHTML = '';
            for (let i=0; i<numProcesses; i++) {
                if (!finish[i]) {
                    deadlocked.push(`P${i}`);
                    const opt = document.createElement('option');
                    opt.value = i; opt.innerText = `P${i}`;
                    killProcessSelect.appendChild(opt);
                }
            }
            
            deadlockedProcsSpan.innerText = deadlocked.join(', ');
            deadlockAlert.classList.remove('hidden');
            sequenceFlow.innerHTML = `<div class="placeholder-text text-red">System is deadlocked. No safe sequence.</div>`;
            logTerminal(`DEADLOCK DETECTED! Recovery protocol enabled.`, 'error');
        }
    }

    // ---------------- Resource Allocation Graph (RAG) ----------------
    const canvas = document.getElementById('rag-canvas');
    const ctx = canvas.getContext('2d');
    let animationId;
    let nodes = [];
    let edges = [];

    function resizeCanvas() {
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
    }
    window.addEventListener('resize', () => { resizeCanvas(); drawRAG(); });
    document.getElementById('btn-refresh-graph').addEventListener('click', drawRAG);

    class Node {
        constructor(id, type, pId, x, y) {
            this.id = id;
            this.type = type; 
            this.pIndex = pId; // Int index
            this.x = x;
            this.y = y;
            this.vx = (Math.random() - 0.5) * 0.5;
            this.vy = (Math.random() - 0.5) * 0.5;
            this.radius = type === 'process' ? 20 : 22;
        }
        update() {
            this.x += this.vx;
            this.y += this.vy;
            if (this.x < this.radius || this.x > canvas.width - this.radius) this.vx *= -1;
            if (this.y < this.radius || this.y > canvas.height - this.radius) this.vy *= -1;
        }
        draw(isHovered) {
            ctx.beginPath();
            if (this.type === 'process') {
                ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                ctx.fillStyle = isHovered ? 'rgba(0, 243, 255, 0.3)' : 'rgba(0, 243, 255, 0.1)';
                ctx.fill();
                ctx.strokeStyle = '#00f3ff';
                ctx.lineWidth = isHovered ? 3 : 2;
                ctx.stroke();
            } else {
                ctx.rect(this.x - this.radius, this.y - this.radius, this.radius*2, this.radius*2);
                ctx.fillStyle = isHovered ? 'rgba(176, 0, 255, 0.3)' : 'rgba(176, 0, 255, 0.1)';
                ctx.fill();
                ctx.strokeStyle = '#b000ff';
                ctx.lineWidth = isHovered ? 3 : 2;
                ctx.stroke();
            }
            ctx.fillStyle = '#fff';
            ctx.font = '12px Orbitron';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(this.id, this.x, this.y);
        }
    }

    function drawRAG() {
        readMatrices();
        resizeCanvas();
        cancelAnimationFrame(animationId);
        
        nodes = []; edges = [];
        
        for(let i=0; i<numProcesses; i++) {
            nodes.push(new Node(`P${i}`, 'process', i, Math.random() * (canvas.width-100) + 50, Math.random() * (canvas.height/2) + 20));
        }
        for(let j=0; j<numResources; j++) {
            nodes.push(new Node(`R${j}`, 'resource', j, Math.random() * (canvas.width-100) + 50, Math.random() * (canvas.height/2) + canvas.height/2 - 20));
        }

        for(let i=0; i<numProcesses; i++) {
            for(let j=0; j<numResources; j++) {
                if (allocation[i][j] > 0) edges.push({from: `R${j}`, to: `P${i}`, type: 'allocation', weight: allocation[i][j]});
                if (need[i][j] > 0) edges.push({from: `P${i}`, to: `R${j}`, type: 'request', weight: need[i][j]});
            }
        }
        animateRAG();
    }

    let hoveredNode = null;

    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        hoveredNode = null;
        for (let node of nodes) {
            const dx = mouseX - node.x;
            const dy = mouseY - node.y;
            if (dx*dx + dy*dy <= node.radius*node.radius) {
                hoveredNode = node;
                break;
            }
        }

        if (hoveredNode) {
            canvas.style.cursor = 'pointer';
            tooltip.classList.add('visible');
            tooltip.style.left = e.clientX + 15 + 'px';
            tooltip.style.top = e.clientY + 15 + 'px';
            
            if (hoveredNode.type === 'process') {
                const p = hoveredNode.pIndex;
                tooltip.innerHTML = `
                    <div><strong>${hoveredNode.id} Stats</strong></div>
                    <div>Alloc: <span class="tt-val">[${allocation[p].join(',')}]</span></div>
                    <div>Max: <span class="tt-val">[${max[p].join(',')}]</span></div>
                    <div>Need: <span class="tt-val">[${need[p].join(',')}]</span></div>
                `;
            } else {
                const r = hoveredNode.pIndex;
                let totalAlloc = 0;
                allocation.forEach(row => totalAlloc += row[r]);
                tooltip.innerHTML = `
                    <div><strong>${hoveredNode.id} Stats</strong></div>
                    <div>Total System: <span class="tt-val">${totalAlloc + available[r]}</span></div>
                    <div>Available: <span class="tt-val">${available[r]}</span></div>
                    <div>Allocated: <span class="tt-val">${totalAlloc}</span></div>
                `;
            }
        } else {
            canvas.style.cursor = 'default';
            tooltip.classList.remove('visible');
        }
    });

    canvas.addEventListener('mouseleave', () => { tooltip.classList.remove('visible'); hoveredNode = null; });

    function animateRAG() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        edges.forEach(edge => {
            const fromNode = nodes.find(n => n.id === edge.from);
            const toNode = nodes.find(n => n.id === edge.to);
            if (fromNode && toNode) {
                ctx.beginPath();
                ctx.moveTo(fromNode.x, fromNode.y);
                ctx.lineTo(toNode.x, toNode.y);
                
                // Highlight edge if connected to hovered node
                const isHighlight = hoveredNode && (hoveredNode.id === edge.from || hoveredNode.id === edge.to);
                
                ctx.strokeStyle = edge.type === 'allocation' ? 
                    (isHighlight ? 'rgba(0, 255, 204, 1)' : 'rgba(0, 255, 204, 0.4)') : 
                    (isHighlight ? 'rgba(255, 0, 60, 1)' : 'rgba(255, 0, 60, 0.4)');
                    
                if (edge.type === 'request') ctx.setLineDash([5, 5]);
                else ctx.setLineDash([]);
                
                ctx.lineWidth = 1 + (edge.weight * 0.5) + (isHighlight ? 1 : 0);
                ctx.stroke();

                const angle = Math.atan2(toNode.y - fromNode.y, toNode.x - fromNode.x);
                const targetX = toNode.x - Math.cos(angle) * toNode.radius;
                const targetY = toNode.y - Math.sin(angle) * toNode.radius;
                
                ctx.beginPath();
                ctx.moveTo(targetX, targetY);
                ctx.lineTo(targetX - 10 * Math.cos(angle - Math.PI/6), targetY - 10 * Math.sin(angle - Math.PI/6));
                ctx.lineTo(targetX - 10 * Math.cos(angle + Math.PI/6), targetY - 10 * Math.sin(angle + Math.PI/6));
                ctx.fillStyle = ctx.strokeStyle;
                ctx.fill();
            }
        });
        ctx.setLineDash([]);

        nodes.forEach(node => {
            node.update();
            node.draw(hoveredNode && hoveredNode.id === node.id);
        });

        animationId = requestAnimationFrame(animateRAG);
    }

    // ---------------- Charts ----------------
    let cpuChart, ramChart;
    
    function initCharts() {
        Chart.defaults.color = '#8a9bb2';
        Chart.defaults.font.family = "'Rajdhani', sans-serif";

        const ctxCpu = document.getElementById('cpuChart').getContext('2d');
        cpuChart = new Chart(ctxCpu, {
            type: 'line',
            data: {
                labels: ['1','2','3','4','5','6','7'],
                datasets: [{
                    label: 'CPU Utilization %',
                    data: [10, 25, 40, 30, 60, 45, 50],
                    borderColor: '#00f3ff',
                    backgroundColor: 'rgba(0, 243, 255, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { y: { beginAtZero: true, max: 100 } },
                plugins: { legend: { display: false } }
            }
        });

        const ctxRam = document.getElementById('ramChart').getContext('2d');
        ramChart = new Chart(ctxRam, {
            type: 'bar',
            data: {
                labels: ['Allocated', 'Available', 'System'],
                datasets: [{
                    label: 'Memory Units',
                    data: [4, 12, 2],
                    backgroundColor: ['rgba(176, 0, 255, 0.6)', 'rgba(0, 255, 204, 0.6)', 'rgba(255, 0, 60, 0.6)'],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } }
            }
        });
    }

    function updateCharts() {
        const newCpu = Math.floor(Math.random() * 80) + 20;
        cpuChart.data.datasets[0].data.shift();
        cpuChart.data.datasets[0].data.push(newCpu);
        cpuChart.update();

        let allocTotal = 0;
        let availTotal = 0;
        allocation.forEach(row => row.forEach(val => allocTotal+=val));
        available.forEach(val => availTotal+=val);
        
        ramChart.data.datasets[0].data = [allocTotal, availTotal, 2];
        ramChart.update();
    }

    // Initialize the app
    initUI();
});
