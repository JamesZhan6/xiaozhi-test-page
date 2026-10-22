// Worker 参数模拟模块：组装 worker_params 帧（协议见 ai-chat-server-deploy/docs/worker参数上行方案2.md §3）
// 浏览器 WebSocket 无法自定义握手 header，worker 标记走 ?worker=1 查询参数，
// 由上游 websocket_server.py 映射为 x-worker header（等价于握手头 X-Worker: 1）。
// 语义：帧里没发的键 = 上游跟随角色配置（有 key 才覆盖）。

const STORAGE_KEY = 'xz_tester_workerParams';
const FIELD_IDS = [
    'workerModeToggle', 'wpVoice', 'wpRate', 'wpPrompt',
    'wpPromptMode', 'wpMemoryMode', 'wpMemoryContent'
];

// 是否以 Worker 身份连接（决定 ?worker=1 参数 + 是否发帧）
export function isWorkerModeEnabled() {
    const toggle = document.getElementById('workerModeToggle');
    return !!(toggle && toggle.checked);
}

// 组装参数帧：空字段/默认值一律省略对应键
export function buildWorkerParamsFrame() {
    const data = {};

    const voice = (document.getElementById('wpVoice')?.value || '').trim();
    const rate = parseInt(document.getElementById('wpRate')?.value, 10);
    if (voice) data.tts = { voice };
    if (!Number.isNaN(rate) && rate !== 0) data.tts = { ...(data.tts || {}), rate };

    const prompt = (document.getElementById('wpPrompt')?.value || '').trim();
    if (prompt) {
        data.llm = {
            system_prompt: prompt,
            prompt_mode: document.getElementById('wpPromptMode')?.value || 'append'
        };
    }

    // 记忆三态：跟随（不发键）/ 关闭 / 覆盖（content 非空才发）
    const memMode = document.getElementById('wpMemoryMode')?.value || 'follow';
    if (memMode === 'off') {
        data.memory = { enabled: false };
    } else if (memMode === 'content') {
        const content = (document.getElementById('wpMemoryContent')?.value || '').trim();
        if (content) data.memory = { content };
    }

    return { type: 'worker_params', version: 1, data };
}

// 初始化面板：实时预览、记忆输入框联动、localStorage 持久化
export function initWorkerParamsUI() {
    restore();

    const refresh = () => {
        save();
        render();
    };

    FIELD_IDS.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const evt = (el.type === 'checkbox' || el.tagName === 'SELECT') ? 'change' : 'input';
        el.addEventListener(evt, refresh);
    });

    render();
}

// 渲染预览与联动显示
function render() {
    const preview = document.getElementById('wpPreview');
    if (preview) {
        const frame = buildWorkerParamsFrame();
        preview.textContent = isWorkerModeEnabled()
            ? JSON.stringify(frame, null, 2)
            : '（未启用 Worker 模式——连接时不发参数帧、不带 worker 标记）';
    }

    const rateValue = document.getElementById('wpRateValue');
    const rate = document.getElementById('wpRate');
    if (rateValue && rate) rateValue.textContent = rate.value;

    const memRow = document.getElementById('wpMemoryContentRow');
    if (memRow) {
        memRow.style.display =
            (document.getElementById('wpMemoryMode')?.value === 'content') ? '' : 'none';
    }

    const status = document.getElementById('workerModeStatus');
    if (status) {
        const on = isWorkerModeEnabled();
        status.textContent = on ? '● Worker 模式' : '● 未启用';
        status.classList.toggle('connected', on);
    }
}

// 持久化到 localStorage（测试中途刷新页面不丢配置）
function save() {
    const state = {};
    FIELD_IDS.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        state[id] = (el.type === 'checkbox') ? el.checked : el.value;
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function restore() {
    let state = null;
    try {
        state = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    } catch (e) {
        state = null;
    }
    if (!state) return;
    FIELD_IDS.forEach(id => {
        const el = document.getElementById(id);
        if (!el || !(id in state)) return;
        if (el.type === 'checkbox') el.checked = !!state[id];
        else el.value = state[id];
    });
}
