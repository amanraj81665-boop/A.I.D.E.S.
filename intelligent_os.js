document.addEventListener('DOMContentLoaded', () => {
    // ---- System Config ----
    let numP = 5;
    let numR = 3;
    let alloc = [], max = [], need = [], avail = [];
    let isDeadlocked = false;
    let deadlockedNodes = [];

    // ---- UI Elements ----
    const clockEl = document.getElementById('os-clock');
    const termEl = document.getElementById('hacker-terminal');
    const btnRun = document.getElementById('btn-run-sim');
    const btnRand = document.getElementById('btn-randomize');
    const btnResetCam = document.getElementById('btn-reset-cam');
    const btnResolve = document.getElementById('btn-ai-resolve');
    const threatAlert = document.getElementById('threat-alert');
    const protocolBadge = document.getElementById('protocol-badge');
    const dlNodesSpan = document.getElementById('deadlocked-nodes');
    const aiChat = document.getElementById('ai-chat');
    const aiWaveform = document.getElementById('ai-waveform');
    const predVal = document.getElementById('pred-val');
    const predBar = document.getElementById('pred-bar');
    const heatmapContainer = document.getElementById('heatmap-container');
    
    // Dynamic Dimension Controls
    const inpNumP = document.getElementById('inp-nump');
    const inpNumR = document.getElementById('inp-numr');
    const valNodes = document.getElementById('val-nodes');
    const valRes = document.getElementById('val-res');

    function updateDimensions() {
        numP = parseInt(inpNumP.value) || 5;
        numR = parseInt(inpNumR.value) || 3;
        valNodes.innerText = numP;
        valRes.innerText = numR;
        initTables();
        randomize();
    }
    
    inpNumP.addEventListener('change', updateDimensions);
    inpNumR.addEventListener('change', updateDimensions);

    // ---- Navigation & Highlights ----
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            const targetClass = link.getAttribute('data-target');
            const targetPanel = document.querySelector('.' + targetClass);
            if (targetPanel) {
                targetPanel.classList.remove('highlight-panel');
                void targetPanel.offsetWidth; // trigger reflow to restart animation
                targetPanel.classList.add('highlight-panel');
                
                // If it's the 3D viewport, optionally reset the camera to draw attention
                if(targetClass === 'viewport-3d') {
                    btnResetCam.click();
                }
            }
        });
    });

    // ---- Clock ----
    setInterval(() => {
        const now = new Date();
        clockEl.innerText = now.toISOString().split('T')[1].replace('Z', '');
    }, 50);

    // ---- Terminal & Voice AI ----
    function sysLog(msg, type='') {
        const div = document.createElement('div');
        div.className = `t-log ${type}`;
        div.innerText = msg;
        termEl.appendChild(div);
        termEl.scrollTop = termEl.scrollHeight;
    }

    function aiSpeak(msg, isAlert=false) {
        aiWaveform.classList.add('talking');
        const span = document.createElement('span');
        span.innerHTML = `> ${msg}`;
        if(isAlert) span.style.color = 'var(--alert-red)';
        aiChat.appendChild(span);
        aiChat.scrollTop = aiChat.scrollHeight;
        
        // Real Audio Synthesis
        if ('speechSynthesis' in window) {
            // Note: removed cancel() because calling it rapidly back-to-back can break Mac/Safari speech engines
            const utterance = new SpeechSynthesisUtterance(msg);
            utterance.rate = 1.0;
            utterance.volume = 1.0;
            utterance.pitch = isAlert ? 0.7 : 1.1; 
            
            // Try to assign a voice if voices are loaded
            const voices = window.speechSynthesis.getVoices();
            if (voices.length > 0) {
                const voice = voices.find(v => v.lang.includes('en') && (v.name.includes('Female') || v.name.includes('Samantha')));
                if (voice) utterance.voice = voice;
            }
            
            window.speechSynthesis.speak(utterance);
        }

        setTimeout(() => { aiWaveform.classList.remove('talking'); }, msg.length * 50);
    }

    // ---- Matrices Logic ----
    function initTables() {
        const createTbl = (id, readOnly) => {
            let h = '<table><tr><th></th>';
            for(let j=0; j<numR; j++) h += `<th>R${j}</th>`;
            h += '</tr>';
            for(let i=0; i<numP; i++) {
                h += `<tr><th>P${i}</th>`;
                for(let j=0; j<numR; j++) {
                    if(readOnly) h += `<td class="readonly" id="${id}_${i}_${j}">0</td>`;
                    else h += `<td><input type="number" id="${id}_${i}_${j}" value="0" min="0"></td>`;
                }
                h += '</tr>';
            }
            h += '</table>';
            document.getElementById(`${id}-table`).innerHTML = h;
        };
        createTbl('alloc', false); createTbl('max', false); createTbl('need', false);
        
        let avH = '';
        for(let j=0; j<numR; j++) avH += `<div>R${j} <input type="number" id="avail_${j}" value="0" min="0"></div>`;
        document.getElementById('avail-inputs').innerHTML = avH;

        document.querySelectorAll('input').forEach(inp => {
            inp.addEventListener('input', () => {
                if(inp.value < 0 || inp.value==='') inp.value = 0;
                updateAI();
            });
        });
    }

    function readData() {
        alloc=[]; max=[]; need=[]; avail=[];
        for(let i=0; i<numP; i++) {
            let aR=[], mR=[], nR=[];
            for(let j=0; j<numR; j++) {
                let a = parseInt(document.getElementById(`alloc_${i}_${j}`).value)||0;
                let m = parseInt(document.getElementById(`max_${i}_${j}`).value)||0;
                let n = parseInt(document.getElementById(`need_${i}_${j}`).value)||0;
                aR.push(a); mR.push(m); nR.push(n);
            }
            alloc.push(aR); max.push(mR); need.push(nR);
        }
        for(let j=0; j<numR; j++) avail.push(parseInt(document.getElementById(`avail_${j}`).value)||0);
    }

    function randomize() {
        const baseAlloc = [[0,1,0],[2,0,0],[3,0,2],[2,1,1],[0,0,2]];
        const baseMax = [[7,5,3],[3,2,2],[9,0,2],[2,2,2],[4,3,3]];
        const baseAvail = [3,3,2];
        const isRand = Math.random() > 0.4; // 60% chance for random chaos
        
        for(let i=0; i<numP; i++) {
            for(let j=0; j<numR; j++) {
                let a = (isRand || !baseAlloc[i] || baseAlloc[i][j]===undefined) ? Math.floor(Math.random()*4) : baseAlloc[i][j];
                let m = (isRand || !baseMax[i] || baseMax[i][j]===undefined) ? a + Math.floor(Math.random()*5) : baseMax[i][j];
                document.getElementById(`alloc_${i}_${j}`).value = a;
                document.getElementById(`max_${i}_${j}`).value = m;
                document.getElementById(`need_${i}_${j}`).value = Math.max(0, m - a);
            }
        }
        for(let j=0; j<numR; j++) {
            document.getElementById(`avail_${j}`).value = (isRand || baseAvail[j]===undefined) ? Math.floor(Math.random()*3) : baseAvail[j];
        }
        updateAI();
        threatAlert.classList.add('hidden');
        protocolBadge.className = 'badge protocol-badge';
        protocolBadge.innerText = 'PROTOCOL: NOMINAL';
        aiSpeak("Scenario matrices generated.");
        build3DGraph();
    }

    // ---- AI Prediction & Heatmap ----
    function updateAI() {
        readData();
        // Calculate Heatmap (Alloc / Max ratio)
        heatmapContainer.innerHTML = '';
        for(let i=0; i<numP; i++) {
            for(let j=0; j<numR; j++) {
                let ratio = max[i][j] > 0 ? (alloc[i][j] / max[i][j]) : 0;
                let cl = 'low';
                if(ratio > 0.5) cl = 'med';
                if(ratio > 0.8) cl = 'high';
                const div = document.createElement('div');
                div.className = `heat-cell ${cl}`;
                div.innerText = `${Math.round(ratio*100)}%`;
                heatmapContainer.appendChild(div);
            }
        }

        // Calculate naive probability of deadlock based on high need vs avail
        let riskScore = 0;
        let totalNeed = 0;
        let totalAvail = avail.reduce((a,b)=>a+b, 0);
        need.forEach(row => row.forEach(n => totalNeed+=n));
        
        if (totalAvail === 0 && totalNeed > 0) riskScore = 95;
        else if (totalNeed === 0) riskScore = 5;
        else {
            let ratio = totalNeed / (totalAvail + 1);
            riskScore = Math.min(99, Math.max(5, ratio * 20));
        }

        predVal.innerText = `${Math.round(riskScore)}%`;
        predBar.style.width = `${riskScore}%`;
        
        if(riskScore > 80) {
            predVal.style.color = 'var(--alert-red)';
            predBar.style.background = 'var(--alert-red)';
        } else {
            predVal.style.color = 'var(--neon-pink)';
            predBar.style.background = 'var(--neon-pink)';
        }
    }

    // ---- Simulation (Banker's) ----
    btnRand.addEventListener('click', randomize);
    btnRun.addEventListener('click', runSimulation);

    function runSimulation() {
        readData();
        sysLog("Initiating OS Safety verification sequence...", "info");
        aiSpeak("Running predictive deadlock analysis.");
        
        let work = [...avail];
        let finish = new Array(numP).fill(false);
        let seq = [];
        let count = 0;

        while(count < numP) {
            let found = false;
            for(let i=0; i<numP; i++) {
                if(!finish[i]) {
                    let canAlloc = true;
                    for(let j=0; j<numR; j++) {
                        if(need[i][j] > work[j]) { canAlloc=false; break; }
                    }
                    if(canAlloc) {
                        for(let j=0; j<numR; j++) work[j] += alloc[i][j];
                        seq.push(i);
                        finish[i] = true;
                        found = true;
                        count++;
                    }
                }
            }
            if(!found) break;
        }

        isDeadlocked = count !== numP;
        
        if(isDeadlocked) {
            deadlockedNodes = [];
            for(let i=0; i<numP; i++) if(!finish[i]) deadlockedNodes.push(`P${i}`);
            sysLog(`CRITICAL: Deadlock imminent. Unsafe state.`, "err");
            aiSpeak(`Warning. Circular wait detected among nodes ${deadlockedNodes.join(',')}`, true);
            dlNodesSpan.innerText = deadlockedNodes.join(', ');
            threatAlert.classList.remove('hidden');
            protocolBadge.className = 'badge protocol-badge alert';
            protocolBadge.innerText = 'PROTOCOL: THREAT';
        } else {
            sysLog(`SUCCESS: Safe state verified. Route: ${seq.map(s=>`P${s}`).join('->')}`, "succ");
            aiSpeak(`System is nominal. Safe execution path found.`);
            threatAlert.classList.add('hidden');
            protocolBadge.className = 'badge protocol-badge';
            protocolBadge.innerText = 'PROTOCOL: SECURE';
        }
        build3DGraph();
    }

    btnResolve.addEventListener('click', () => {
        if(deadlockedNodes.length > 0) {
            const target = deadlockedNodes[0];
            const pId = parseInt(target.replace('P',''));
            aiSpeak(`Executing override. Terminating node ${target}.`);
            sysLog(`[AI RECOVERY] Terminating ${target} and releasing resources...`, "warn");
            
            for(let j=0; j<numR; j++) {
                let a = parseInt(document.getElementById(`alloc_${pId}_${j}`).value)||0;
                let av = parseInt(document.getElementById(`avail_${j}`).value)||0;
                document.getElementById(`avail_${j}`).value = av + a;
                document.getElementById(`alloc_${pId}_${j}`).value = 0;
                document.getElementById(`max_${pId}_${j}`).value = 0;
                document.getElementById(`need_${pId}_${j}`).value = 0;
            }
            updateAI();
            runSimulation();
        }
    });

    // ---- Three.js Engine ----
    const container = document.getElementById('threejs-container');
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);
    const pointLight = new THREE.PointLight(0x00e5ff, 2, 100);
    pointLight.position.set(0, 10, 0);
    scene.add(pointLight);

    let graphGroup = new THREE.Group();
    scene.add(graphGroup);

    function build3DGraph() {
        // Clear old graph
        while(graphGroup.children.length > 0){ 
            graphGroup.remove(graphGroup.children[0]); 
        }

        const pRadius = 6;
        const pNodes = [];
        const rNodes = [];

        // Materials
        const pMat = new THREE.MeshPhongMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.8, emissive: 0x0055ff, emissiveIntensity: 0.5 });
        const pMatAlert = new THREE.MeshPhongMaterial({ color: 0xff003c, transparent: true, opacity: 0.9, emissive: 0xff0000, emissiveIntensity: 0.8 });
        const rMat = new THREE.MeshPhongMaterial({ color: 0x9d00ff, transparent: true, opacity: 0.8, emissive: 0x5500aa, emissiveIntensity: 0.5 });
        
        // Geometry
        const pGeo = new THREE.SphereGeometry(0.8, 32, 32);
        const rGeo = new THREE.BoxGeometry(1.2, 1.2, 1.2);

        // Position Processes in a circle above
        for(let i=0; i<numP; i++) {
            const angle = (i / numP) * Math.PI * 2;
            const isDL = isDeadlocked && deadlockedNodes.includes(`P${i}`);
            const mesh = new THREE.Mesh(pGeo, isDL ? pMatAlert : pMat);
            mesh.position.set(Math.cos(angle) * pRadius, 3, Math.sin(angle) * pRadius);
            graphGroup.add(mesh);
            pNodes.push(mesh.position);
            
            // Sprite Label
            addLabel(`P${i}`, mesh.position.x, mesh.position.y + 1.5, mesh.position.z, isDL ? '#ff003c' : '#00e5ff');
        }

        // Position Resources in a smaller circle below
        const rRadius = 3;
        for(let j=0; j<numR; j++) {
            const angle = (j / numR) * Math.PI * 2;
            const mesh = new THREE.Mesh(rGeo, rMat);
            mesh.position.set(Math.cos(angle) * rRadius, -3, Math.sin(angle) * rRadius);
            graphGroup.add(mesh);
            rNodes.push(mesh.position);
            
            addLabel(`R${j}`, mesh.position.x, mesh.position.y - 1.5, mesh.position.z, '#9d00ff');
        }

        // Edges
        const lineMatAlloc = new THREE.LineBasicMaterial({ color: 0x00ffcc, linewidth: 2 });
        const lineMatReq = new THREE.LineDashedMaterial({ color: 0xff003c, linewidth: 2, dashSize: 0.3, gapSize: 0.2 });

        for(let i=0; i<numP; i++) {
            for(let j=0; j<numR; j++) {
                if(alloc[i] && alloc[i][j] > 0) {
                    // Resource -> Process
                    const geom = new THREE.BufferGeometry().setFromPoints([rNodes[j], pNodes[i]]);
                    const line = new THREE.Line(geom, lineMatAlloc);
                    graphGroup.add(line);
                }
                if(need[i] && need[i][j] > 0) {
                    // Process -> Resource
                    const geom = new THREE.BufferGeometry().setFromPoints([pNodes[i], rNodes[j]]);
                    const line = new THREE.Line(geom, lineMatReq);
                    line.computeLineDistances();
                    graphGroup.add(line);
                }
            }
        }
    }

    function addLabel(text, x, y, z, color) {
        const canvas = document.createElement('canvas');
        canvas.width = 128; canvas.height = 64;
        const context = canvas.getContext('2d');
        context.font = 'Bold 30px Audiowide';
        context.fillStyle = color;
        context.textAlign = 'center';
        context.fillText(text, 64, 40);
        
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.position.set(x, y, z);
        sprite.scale.set(3, 1.5, 1);
        graphGroup.add(sprite);
    }

    camera.position.set(0, 8, 15);
    camera.lookAt(0,0,0);

    btnResetCam.addEventListener('click', () => {
        camera.position.set(0, 8, 15);
        controls.target.set(0,0,0);
    });

    const clock = new THREE.Clock();
    function animate3D() {
        requestAnimationFrame(animate3D);
        controls.update();
        graphGroup.rotation.y += 0.002; // Slow spin
        renderer.render(scene, camera);
    }

    window.addEventListener('resize', () => {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    });

    // ---- Chart.js (Telemetry) ----
    const ctxPerf = document.getElementById('perfChart').getContext('2d');
    Chart.defaults.color = '#64748b';
    Chart.defaults.font.family = "'Share Tech Mono', monospace";
    
    let perfChart = new Chart(ctxPerf, {
        type: 'line',
        data: {
            labels: ['-6s','-5s','-4s','-3s','-2s','-1s','0s'],
            datasets: [{
                label: 'CPU', data: [20,30,25,50,40,70,60],
                borderColor: '#00e5ff', backgroundColor: 'rgba(0,229,255,0.1)', borderWidth: 2, fill: true, tension: 0.3
            }, {
                label: 'RAM', data: [40,40,45,45,50,45,45],
                borderColor: '#9d00ff', backgroundColor: 'rgba(157,0,255,0.1)', borderWidth: 2, fill: true, tension: 0.3
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100 } }, plugins: { legend: { display: false } } }
    });

    setInterval(() => {
        perfChart.data.datasets[0].data.shift();
        perfChart.data.datasets[0].data.push(Math.floor(Math.random() * 40) + (isDeadlocked?50:20));
        perfChart.data.datasets[1].data.shift();
        let rTotal = avail.reduce((a,b)=>a+b,0);
        perfChart.data.datasets[1].data.push(Math.min(100, 30 + rTotal*2));
        perfChart.update();
    }, 1000);

    // ---- Boot ----
    initTables();
    randomize();
    animate3D();
    sysLog("OS Kernel v9.4 Loaded.", "succ");
});
