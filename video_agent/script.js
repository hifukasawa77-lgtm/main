document.addEventListener('DOMContentLoaded', () => {
    const chatForm = document.getElementById('chatForm');
    const chatArea = document.getElementById('chatArea');
    const userInput = document.getElementById('userInput');

    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = userInput.value.trim();
        if (!text) return;

        // User message
        addMessage(text, 'user');
        userInput.value = '';

        // Agent processing
        setTimeout(() => {
            simulateAgentResponse(text);
        }, 800);
    });

    function addMessage(text, sender, isHtml = false) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', sender);

        if (sender === 'agent') {
            messageDiv.innerHTML = `
                <div class="agent-avatar">V</div>
                <div class="agent-bubble">${isHtml ? text : escapeHtml(text)}</div>
            `;
        } else {
            messageDiv.textContent = text;
        }

        chatArea.appendChild(messageDiv);
        scrollToBottom();
        return messageDiv;
    }

    function simulateAgentResponse(prompt) {
        const agentMsg = addMessage(`「${prompt}」に基づいた動画を作成しています。しばらくお待ちください...`, 'agent');
        
        // Add generation placeholder
        const videoContainer = document.createElement('div');
        videoContainer.classList.add('video-container');
        videoContainer.innerHTML = `
            <div class="generating-overlay">
                <div class="spinner"></div>
                <div class="generating-text">Generating Video Assets... 0%</div>
            </div>
        `;
        agentMsg.querySelector('.agent-bubble').appendChild(videoContainer);
        scrollToBottom();

        // Simulate progress
        let progress = 0;
        const progressText = videoContainer.querySelector('.generating-text');
        const interval = setInterval(() => {
            progress += Math.floor(Math.random() * 15) + 5;
            if (progress >= 100) {
                progress = 100;
                clearInterval(interval);
                finishGeneration(videoContainer, prompt);
            }
            progressText.textContent = `Generating Video Assets... ${progress}%`;
        }, 500);
    }

    function finishGeneration(container, prompt) {
        // Remove overlay
        container.innerHTML = '';
        
        // Select video based on keywords
        let videoSrc = 'https://archive.org/download/BigBuckBunny_124/Content/big_buck_bunny_720p_surround.mp4'; // Default
        
        const lowerPrompt = prompt.toLowerCase();
        if (lowerPrompt.includes('宇宙') || lowerPrompt.includes('space') || lowerPrompt.includes('星')) {
            videoSrc = 'https://archive.org/download/NasaApollo11MoonLanding/Apollo11MoonLanding.mp4';
        } else if (lowerPrompt.includes('空') || lowerPrompt.includes('飛行') || lowerPrompt.includes('雲') || lowerPrompt.includes('sky') || lowerPrompt.includes('fly')) {
            videoSrc = 'https://player.vimeo.com/external/394132800.sd.mp4?s=91d32788939c3395c87e5b746c2409f56475653b&profile_id=139&oauth2_token_id=57447761';
        } else if (lowerPrompt.includes('街') || lowerPrompt.includes('都市') || lowerPrompt.includes('city') || lowerPrompt.includes('ビル') || lowerPrompt.includes('車') || lowerPrompt.includes('car')) {
            videoSrc = 'https://player.vimeo.com/external/406341203.sd.mp4?s=12d1c9c8e19e710b78d6e9f87d7f7a74070035c7&profile_id=139&oauth2_token_id=57447761';
        }

        // Add actual video player
        const video = document.createElement('video');
        video.src = videoSrc;
        video.controls = true;
        video.autoplay = true;
        video.muted = true;
        video.loop = true;
        video.setAttribute('playsinline', ''); // Add playsinline for mobile/safari
        
        container.appendChild(video);
        
        // Update text
        const bubble = container.parentElement;
        const successText = document.createElement('p');
        successText.style.marginTop = '12px';
        successText.textContent = `動画の生成が完了しました！テーマ: ${prompt}`;
        bubble.appendChild(successText);
        
        scrollToBottom();
    }

    function scrollToBottom() {
        chatArea.scrollTop = chatArea.scrollHeight;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
});
