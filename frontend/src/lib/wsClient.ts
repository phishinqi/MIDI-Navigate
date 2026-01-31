type AudioLevelCallback = (level: number) => void;

class WebSocketClient {
    private ws: WebSocket | null = null;
    private listeners: AudioLevelCallback[] = [];
    private reconnectTimeout: any = null;
    private url: string;

    constructor(url: string = 'ws://localhost:5173/ws') { // Use Vite proxy
        this.url = url;
    }

    connect() {
        if (this.ws) return;

        // In dev, Vite proxies /ws to backend. 
        // If production, might need full URL.
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const wsUrl = `${protocol}//${host}/ws`;

        console.log(`Connecting to WebSocket at ${wsUrl}`);
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            console.log('WS Connected');
            if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
        };

        this.ws.onclose = () => {
            console.log('WS Closed');
            this.ws = null;
            this.reconnectTimeout = setTimeout(() => this.connect(), 3000);
        };

        this.ws.onerror = (err) => {
            console.error('WS Error', err);
        };

        this.ws.onmessage = (event) => {
            const data = event.data;
            if (typeof data === 'string') {
                if (data.startsWith('AUDIO_LEVEL:')) {
                    const level = parseFloat(data.split(':')[1]);
                    this.listeners.forEach(cb => cb(level));
                }
            }
        };
    }

    addListener(cb: AudioLevelCallback) {
        this.listeners.push(cb);
        return () => {
            this.listeners = this.listeners.filter(l => l !== cb);
        };
    }

    close() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}

export const wsClient = new WebSocketClient();
