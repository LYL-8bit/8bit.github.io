// 解析题目数据
async function fetchQuestions() {
    try {
        const response = await fetch('timu.txt');
        const text = await response.text();
        return parseQuestions(text);
    } catch (error) {
        console.error('获取题目失败:', error);
        return [];
    }
}

function parseQuestions(text) {
    const questions = [];
    const questionBlocks = text.split(/第\d+题/).slice(1);
    
    questionBlocks.forEach((block, index) => {
        // 提取题目信息
        const titleMatch = block.match(/（(\d+\.\d+)分）\s*题号:(\d+)\s*难度:([^\s]+)\s*第(\d+)章/);
        if (!titleMatch) return;
        
        const [, score, id, difficulty, chapter] = titleMatch;
        
        // 提取题目内容和选项
        const contentMatch = block.match(/章\s*\n\s*\n([\s\S]*?)\(A\)([\s\S]*?)(?:\(B\)([\s\S]*?))?(?:\(C\)([\s\S]*?))?(?:\(D\)([\s\S]*?))?(?:\n\n|$)/);
        if (!contentMatch) return;
        
        const [, content, optionA, optionB, optionC, optionD] = contentMatch;
        
        const options = {
            A: optionA.trim(),
            B: optionB ? optionB.trim() : '',
            C: optionC ? optionC.trim() : '',
            D: optionD ? optionD.trim() : ''
        };
        
        questions.push({
            number: index + 1,
            score,
            id,
            difficulty,
            chapter,
            content: content.trim(),
            options
        });
    });
    
    return questions;
}

// 渲染题目到页面
function renderQuestions(questions) {
    const container = document.getElementById('questions-container');
    container.innerHTML = '';
    
    questions.forEach(question => {
        const questionCard = document.createElement('div');
        questionCard.className = 'question-card';
        questionCard.id = `question-${question.number}`;
        
        const header = document.createElement('div');
        header.className = 'question-header';
        
        const title = document.createElement('div');
        title.className = 'question-title';
        title.textContent = `第${question.number}题 （${question.score}分）`;
        
        const meta = document.createElement('div');
        meta.className = 'question-meta';
        meta.textContent = `题号:${question.id} 难度:${question.difficulty} 第${question.chapter}章`;
        
        header.appendChild(title);
        header.appendChild(meta);
        
        const content = document.createElement('div');
        content.className = 'question-content';
        content.textContent = question.content;
        
        const options = document.createElement('div');
        options.className = 'options';
        
        for (const [key, value] of Object.entries(question.options)) {
            if (value) {
                const option = document.createElement('div');
                option.className = 'option';
                option.textContent = `(${key})${value}`;
                options.appendChild(option);
            }
        }
        
        const aiButton = document.createElement('button');
        aiButton.className = 'ai-button';
        aiButton.textContent = 'AI答题';
        aiButton.onclick = () => getAIAnswer(question);
        
        const aiAnswer = document.createElement('div');
        aiAnswer.className = 'ai-answer';
        aiAnswer.id = `answer-${question.number}`;
        
        const answerTitle = document.createElement('h4');
        answerTitle.textContent = 'AI解答';
        
        const answerContent = document.createElement('div');
        answerContent.className = 'answer-content';
        answerContent.id = `answer-content-${question.number}`;
        
        aiAnswer.appendChild(answerTitle);
        aiAnswer.appendChild(answerContent);
        
        questionCard.appendChild(header);
        questionCard.appendChild(content);
        questionCard.appendChild(options);
        questionCard.appendChild(aiButton);
        questionCard.appendChild(aiAnswer);
        
        container.appendChild(questionCard);
    });
}

// 调用DeepSeek API获取AI答案
async function getAIAnswer(question) {
    const answerDiv = document.getElementById(`answer-${question.number}`);
    const answerContent = document.getElementById(`answer-content-${question.number}`);
    
    // 显示加载状态
    answerDiv.style.display = 'block';
    answerDiv.classList.add('loading');
    answerContent.innerHTML = '<span class="loading-dots">AI正在思考中</span>';
    
    // 构建消息数组
    const messages = [
        {
            role: "system",
            content: "你是一个专业的答题助手，请按照以下格式回答问题：\n1. 先输出'正确答案：X'（其中X是A、B、C或D中的一个选项）\n2. 然后空一行，输出详细解析"
        },
        {
            role: "user",
            content: `题目：${question.content}\n(A)${question.options.A}\n(B)${question.options.B}\n(C)${question.options.C}\n(D)${question.options.D}`
        }
    ];
    
    try {
        // 使用DeepSeek API获取回答
        const response = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer you-deepseek-key'
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: messages,
                stream: true
            })
        });
        
        // 检查响应状态
        if (!response.ok) {
            throw new Error(`API请求失败: ${response.status}`);
        }
        
        // 处理流式响应
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        answerContent.textContent = '';
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            // 解析JSON响应
            const lines = chunk.split('\n').filter(line => line.trim());
            
            for (const line of lines) {
                try {
                    if (line.startsWith('data: ')) {
                        const data = JSON.parse(line.slice(6));
                        if (data.choices && data.choices[0].delta.content) {
                            answerContent.textContent += data.choices[0].delta.content;
                        }
                    }
                } catch (e) {
                    console.error('解析响应出错:', e, line);
                }
            }
        }
        
        // 移除加载状态
        answerDiv.classList.remove('loading');
        
    } catch (error) {
        console.error('获取AI答案失败:', error);
        answerContent.textContent = `获取答案失败: ${error.message}`;
        answerDiv.classList.remove('loading');
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', async () => {
    const questions = await fetchQuestions();
    renderQuestions(questions);
});
