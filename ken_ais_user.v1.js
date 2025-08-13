// ==UserScript==
// @name         KEN AI - Assistente de Estudos
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  Assistente AI lateral compacto para estudos com Gemini
// @author       KEN AI
// @match        *://*/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
  'use strict';

  // Verificar se o KEN AI já foi inicializado
  if (window.kenAiInitialized) {
    console.warn('KEN AI já foi inicializado. Removendo instância duplicada.');
    return;
  }

  window.kenAiInitialized = true;

  // Adicionar função de limpeza para remover instâncias ao sair da página
  window.addEventListener('beforeunload', () => {
    window.kenAiInitialized = false;
  });

  // Carregar html2canvas e markdown-it
  (function loadDependencies() {
    // Carregar html2canvas
    if (!window.html2canvas) {
      try {
        fetch('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js')
          .then(response => response.text())
          .then(scriptText => {
            const scriptElement = document.createElement('script');
            scriptElement.textContent = scriptText;
            document.head.appendChild(scriptElement);
            console.log('html2canvas carregado para KEN AI');
          })
          .catch(error => {
            console.warn('Falha ao carregar html2canvas:', error);
          });
      } catch (error) {
        console.warn('Falha ao carregar html2canvas:', error);
      }
    }

    // Carregar markdown-it e plugins
    if (!window.markdownit) {
      const scripts = [
        'https://cdn.jsdelivr.net/npm/markdown-it@13.0.1/dist/markdown-it.min.js',
        'https://cdn.jsdelivr.net/npm/markdown-it-sup@1.0.0/dist/markdown-it-sup.min.js',
        'https://cdn.jsdelivr.net/npm/markdown-it-sub@1.0.0/dist/markdown-it-sub.min.js',
        'https://cdn.jsdelivr.net/npm/markdown-it-emoji@2.0.2/dist/markdown-it-emoji.min.js',
        'https://cdn.jsdelivr.net/npm/markdown-it-task-lists@2.1.1/dist/markdown-it-task-lists.min.js'
      ];

      Promise.all(scripts.map(src =>
        fetch(src)
          .then(response => response.text())
          .then(scriptText => {
            const scriptElement = document.createElement('script');
            scriptElement.textContent = scriptText;
            document.head.appendChild(scriptElement);
          })
      )).then(() => {
        // Configurar markdown-it após carregar todos os plugins
        window.md = window.markdownit({
          html: true,
          linkify: true,
          typographer: true,
          breaks: true
        })
          .use(window.markdownitSup)
          .use(window.markdownitSub)
          .use(window.markdownitEmoji)
          .use(window.markdownitTaskLists);

        console.log('markdown-it e plugins carregados para KEN AI');
      }).catch(error => {
        console.warn('Falha ao carregar markdown-it ou plugins:', error);
      });
    }
  })();

  // Carregar KaTeX para renderização de fórmulas matemáticas em tempo real
  (function loadKaTeX() {
    if (window.katex) return;

    // Carregar CSS do KaTeX
    const katexCSS = document.createElement('link');
    katexCSS.rel = 'stylesheet';
    katexCSS.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css';
    katexCSS.crossOrigin = 'anonymous';
    document.head.appendChild(katexCSS);

    // Carregar JavaScript do KaTeX usando fetch para contornar restrições de CSP
    try {
      fetch('https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js')
        .then(response => response.text())
        .then(scriptText => {
          const scriptElement = document.createElement('script');
          scriptElement.textContent = scriptText;
          document.head.appendChild(scriptElement);
          console.log('KaTeX carregado para KEN AI');

          // Carregar extensão auto-render também usando fetch
          fetch('https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/contrib/auto-render.min.js')
            .then(response => response.text())
            .then(autoRenderText => {
              const autoRenderScript = document.createElement('script');
              autoRenderScript.textContent = autoRenderText;
              document.head.appendChild(autoRenderScript);
              console.log('KaTeX auto-render carregado');
              window.katexReady = true;
            })
            .catch(error => {
              console.warn('Falha ao carregar KaTeX auto-render:', error);
            });
        })
        .catch(error => {
          console.warn('Falha ao carregar KaTeX:', error);
        });
    } catch (error) {
      console.warn('Falha ao carregar KaTeX:', error);
    }
  })();

  // Função para mostrar mensagem de status da IA
  function showAiStatus(message) {
    const statusDiv = document.createElement('div');
    statusDiv.className = 'ken-ai-status';
    statusDiv.textContent = message;
    document.body.appendChild(statusDiv);
    setTimeout(() => statusDiv.remove(), 2000);
  }

  // Função para capturar screenshot
  async function captureScreenshot() {
    try {
      const canvas = await html2canvas(document.body);
      const imageUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = 'ken-ai-status.png';
      link.click();
    } catch (error) {
      console.error('Erro ao capturar screenshot:', error);
    }
  }

  // Função para capturar dados da página
  async function capturePageData() {
    const pageData = {
      url: window.location.href,
      title: document.title,
      screenshot: null,
    };


    try {
      if (window.html2canvas) {
        const canvas = await html2canvas(document.body, {
          height: Math.min(document.body.scrollHeight, 2000),
          width: Math.min(document.body.scrollWidth, 1200),
          useCORS: true,
          allowTaint: true,
        });

        // Converter canvas para arquivo
        const dataURL = canvas.toDataURL('image/png');
        const response = await fetch(dataURL);
        const blob = await response.blob();

        // Criar arquivo a partir do blob
        pageData.screenshot = new File([blob], 'page-screenshot.png', {
          type: 'image/png',
        });
      }
    } catch (error) {
      console.warn('Erro ao capturar screenshot da página:', error);
    }

    return pageData;
  }

  // Função para buscar na página
  async function searchPage(query) {
    // Limpar qualquer status anterior
    const existingStatus = document.querySelector('.ken-ai-status');
    if (existingStatus) existingStatus.remove();

    // Mostrar status de busca
    showAiStatus('Buscando...');

    setTimeout(async () => {
      // Atualizar status para análise
      const existingStatus = document.querySelector('.ken-ai-status');
      if (existingStatus) existingStatus.textContent = 'Analisando...';

      await captureScreenshot();

      const textNodes = document.evaluate(
        '//text()',
        document.body,
        null,
        XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE,
        null
      );

      setTimeout(async () => {
        // Status final
        const existingStatus = document.querySelector('.ken-ai-status');
        if (existingStatus) existingStatus.textContent = 'Concluído!';

        // Remover status após 2 segundos
        setTimeout(() => {
          if (existingStatus) existingStatus.remove();
        }, 2000);
      }, 1000);
    }, 1000);
  }

  // Função para remover instâncias duplicadas
  function removeDuplicateInstances() {
    const existingPanels = document.querySelectorAll('.ken-ai-sidebar-panel');
    const existingFloatingButtons = document.querySelectorAll('.ken-ai-floating-btn');

    if (existingPanels.length > 1) {
      for (let i = 1; i < existingPanels.length; i++) {
        existingPanels[i].remove();
      }
    }

    if (existingFloatingButtons.length > 1) {
      for (let i = 1; i < existingFloatingButtons.length; i++) {
        existingFloatingButtons[i].remove();
      }
    }
  }

  // Gerenciador de imagens
  const imageManager = {
    images: new Map(),
    previewContainer: null,

    init(previewContainer) {
      this.previewContainer = previewContainer;
      this.setupDropZone();
    },

    setupDropZone() {
      const dropZone = document.querySelector('.ken-ai-drop-zone');
      if (!dropZone) return;

      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
      });

      dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
      });

      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');

        const files = Array.from(e.dataTransfer.files);
        files.forEach(file => {
          if (file.type.startsWith('image/')) {
            this.addImage(file);
          }
        });
      });
    },

    addImage(file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const id = 'img-' + Date.now();
        const imgContainer = document.createElement('div');
        imgContainer.className = 'ken-ai-preview-image-container';
        imgContainer.dataset.id = id;

        const img = document.createElement('img');
        img.src = e.target.result;
        img.className = 'ken-ai-preview-image';

        const removeBtn = document.createElement('button');
        removeBtn.className = 'ken-ai-remove-image';
        removeBtn.innerHTML = '×';
        removeBtn.onclick = () => this.removeImage(id);

        imgContainer.appendChild(img);
        imgContainer.appendChild(removeBtn);
        this.previewContainer.appendChild(imgContainer);

        this.images.set(id, {
          file: file,
          element: imgContainer
        });
      };
      reader.readAsDataURL(file);
    },

    removeImage(id) {
      const image = this.images.get(id);
      if (image) {
        image.element.remove();
        this.images.delete(id);
      }
    },

    clearImages() {
      this.images.clear();
      if (this.previewContainer) {
        this.previewContainer.innerHTML = '';
      }
    }
  };

  // Executar remoção de instâncias duplicadas
  removeDuplicateInstances();

  // Configurações da API
  const API_KEYS = [
    'AIzaSyD72Gjk1xWO18818wTiKT3mTUch1pUQF4U',
    'AIzaSyABVdHcBBGm_R6LJQlfRvu_WE5_6qGM_rk',
    'AIzaSyCCq1UaDPA3cetcT0cu8I7GX1IcKKhu30c',
    'AIzaSyB0yuUPayObFwpOx1fD0wk-U5V5OSXes_U',
    'AIzaSyC_WOovKe2AUnz89B2SOtdW0bsY_1APp6k',
  ];

  let currentApiIndex = 0;
  let chatHistory = [];
  let miniChatHistory = [];
  let isListening = false;
  let recognition = null;
  let currentFile = null;
  let uploadedFiles = [];

  // Configuração do Markdown-it
  function setupMarkdownIt() {
    if (!window.md) return;

    // Configurar regras personalizadas para o markdown-it
    window.md.renderer.rules.emoji = function (token, idx) {
      return token[idx].content;
    };

    // Configurar highlight.js para código
    window.md.options.highlight = function (str, lang) {
      if (lang && hljs.getLanguage(lang)) {
        try {
          return hljs.highlight(str, { language: lang }).value;
        } catch (__) { }
      }
      return ''; // usar highlight.js default
    };
  }

  // Função para processar o markdown da resposta
  function processMarkdownResponse(text) {
    if (!window.md) return text;

    const processedText = window.md.render(text)
      .replace(/<table>/g, '<table class="ken-ai-table">')
      .replace(/<pre><code>/g, '<pre><code class="ken-ai-code">');

    return processedText;
  }

  // Prompts personalizados por tipo de pergunta
  const promptTemplates = {
    general: {
      system: "Você é um assistente de IA preciso e direto. Responda usando Markdown formatado corretamente, com títulos, listas, e código quando necessário.",
      format: (query) => `${query}\n\nResponda de forma clara e direta, usando Markdown apropriado.`
    },
    code: {
      system: "Você é um especialista em programação. Use blocos de código Markdown (```) com a linguagem especificada, e explique o código de forma clara.",
      format: (query) => `${query}\n\nForneça o código com explicações em Markdown, usando blocos de código com syntax highlighting.`
    },
    math: {
      system: "Você é um especialista em matemática. Use LaTeX para fórmulas matemáticas entre $$ para display math ou $ para inline math.",
      format: (query) => `${query}\n\nMostre os cálculos e fórmulas usando LaTeX no formato Markdown.`
    },
    table: {
      system: "Você é um especialista em organização de dados. Use tabelas Markdown bem formatadas para apresentar informações.",
      format: (query) => `${query}\n\nApresente os dados em uma tabela Markdown bem estruturada.`
    }
  };

  // Objeto para gerenciar estado das chaves API
  const apiKeyManager = {
    keys: API_KEYS,
    keyStats: {},

    // Inicializar estatísticas para cada chave
    initializeKeyStats() {
      this.keys.forEach((key) => {
        this.keyStats[key] = {
          usageCount: 0,
          lastUsedTimestamp: 0,
          cooldownUntil: 0,
          failureCount: 0,
        };
      });
    },

    // Obter próxima chave API disponível
    getNextAvailableKey() {
      const now = Date.now();

      // Primeiro, tentar chaves sem cooldown
      const availableKeys = this.keys.filter((key) => this.keyStats[key].cooldownUntil <= now);

      if (availableKeys.length > 0) {
        // Escolher chave com menos falhas
        return availableKeys.reduce((bestKey, currentKey) =>
          this.keyStats[currentKey].failureCount < this.keyStats[bestKey].failureCount
            ? currentKey
            : bestKey
        );
      }

      // Se todas as chaves estiverem em cooldown, retornar a primeira
      return this.keys[0];
    },

    // Registrar uso bem-sucedido da chave
    markKeySuccess(key) {
      const stats = this.keyStats[key];
      stats.usageCount++;
      stats.lastUsedTimestamp = Date.now();
      stats.failureCount = Math.max(0, stats.failureCount - 1);
      stats.cooldownUntil = 0;
    },

    // Registrar falha na chave
    markKeyFailure(key) {
      const stats = this.keyStats[key];
      stats.failureCount++;

      // Aplicar cooldown progressivo
      const cooldownTime = Math.min(
        30 * 60 * 1000, // Máximo 30 minutos
        5 * 60 * 1000 * Math.pow(2, stats.failureCount) // Exponencial
      );

      stats.cooldownUntil = Date.now() + cooldownTime;
      console.warn(`Chave ${key} em cooldown por ${cooldownTime / 1000 / 60} minutos`);
    },
  };

  // Inicializar estatísticas das chaves
  apiKeyManager.initializeKeyStats();

  // Estilos CSS para painel lateral compacto
  let stylesContent = `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        @import url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css');

        .ken-ai-sidebar-panel {
            position: fixed;
            top: 0;
            right: -500px;
            width: 550px;
            min-width: 520px;
            max-width: 800px;
            height: 101vh;
            background: linear-gradient(180deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%);
            box-shadow: -10px 0 30px rgba(0, 0, 0, 0.3);
            z-index: 999999;
            font-family: 'Inter', sans-serif;
            transition: right 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            border-left: 1px solid rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(20px);
            opacity: 0;
            pointer-events: none;
        }

        .ken-ai-sidebar-panel.open {
            right: 0;
            opacity: 1;
            pointer-events: auto;
        }

        .ken-ai-header {
            position: sticky;
            top: 0;
            z-index: 2;
            border-radius: 20px;
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(20px);
            padding: 15px 20px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.15);
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .ken-ai-header-actions {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        /* Toolbar compacta no cabeçalho */
        .ken-ai-toolbar {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 4px;
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.16);
            border-radius: 12px;
            backdrop-filter: blur(12px);
        }

        /* Botão de ícone genérico para a head */
        .ken-ai-icon-btn {
            width: 32px;
            height: 32px;
            border: 1px solid rgba(255, 255, 255, 0.18);
            border-radius: 10px;
            background: rgba(255, 255, 255, 0.10);
            color: #fff;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.3s ease;
        }

        .ken-ai-icon-btn:hover {
            background: rgba(255, 255, 255, 0.18);
            transform: translateY(-1px);
            box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
        }

        /* Versão compacta do botão Novo Chat apenas na head */
        .ken-ai-header .ken-ai-new-chat-btn {
            border-radius: 10px;
            height: 32px;
            align-items: center;
            padding: 5px 5px;
            position: relative;
            bottom: 5px;
            font-size: 11px;
            gap: 6px;
            box-shadow: 0 6px 16px rgba(99, 102, 241, 0.25);
        }

        .ken-ai-header .ken-ai-new-chat-btn i {
            width: 18px;
            height: 18px;
            font-size: 11px;
        }

        .ken-ai-new-chat-btn .btn-label { display: inline; }
        @media (max-width: 520px) {
            .ken-ai-new-chat-btn .btn-label { display: none; }
        }

        .ken-ai-new-chat-container {
            display: flex;
            height: 40px;
            align-items: center;
            background: rgba(255, 255, 255, 0.10);
            border: 1px solid rgba(255, 255, 255, 0.18);
            border-radius: 14px;
            padding: 4px;
            backdrop-filter: blur(16px);
        }

        .ken-ai-new-chat-btn {
            position: relative;
            background: linear-gradient(135deg, #6d75ff, #8b5cf6);
            border: 1px solid rgba(255, 255, 255, 0.22);
            border-radius: 12px;
            height: 36px;
            padding: 0 14px;
            color: #fff;
            font-size: 12px;
            font-weight: 700;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.3s ease;
            box-shadow: 0 6px 18px rgba(99, 102, 241, 0.25);
            outline: none;
            user-select: none;
        }

        .ken-ai-new-chat-btn:hover {
            background: linear-gradient(135deg, #7b85ff, #9c6ef7);
            transform: translateY(-1px);
            box-shadow: 0 8px 22px rgba(99, 102, 241, 0.35);
        }

        .ken-ai-new-chat-btn i {
            width: 20px;
            height: 20px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            border-radius: 6px;
            background: rgba(255, 255, 255, 0.18);
            box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.25);
        }



        .ken-ai-stats-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
        }

        .ken-ai-stat-item {
            text-align: center;
            padding: 10px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 8px;
        }

        .ken-ai-stat-number {
            color: #ffd93d;
            font-size: 20px;
            font-weight: 700;
            display: block;
        }

        .ken-ai-stat-label {
            color: rgba(255, 255, 255, 0.8);
            font-size: 10px;
            margin-top: 5px;
        }

        .ken-ai-history-panel {
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 15px;
            padding: 15px;
            margin: 15px 0;
            backdrop-filter: blur(10px);
            position: relative;
        }

        .ken-ai-history-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .ken-ai-history-title {
            color: #ffd93d;
            font-size: 12px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .ken-ai-history-stats {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            padding: 4px 8px;
            font-size: 10px;
            color: white;
        }

        .ken-ai-conversations-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
            max-height: 250px;
            overflow-y: auto;
            padding-right: 5px;
        }

        .ken-ai-conversations-list::-webkit-scrollbar {
            width: 6px;
        }

        .ken-ai-conversations-list::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 3px;
        }

        .ken-ai-conversations-list::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.3);
            border-radius: 3px;
            transition: background 0.3s ease;
        }

        .ken-ai-conversations-list::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.5);
        }

        .ken-ai-conversation-item {
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 10px;
            padding: 12px;
            cursor: pointer;
            transition: all 0.3s ease;
            position: relative;
        }

        .ken-ai-conversation-item:hover {
            background: rgba(255, 255, 255, 0.15);
            transform: translateY(-1px);
            box-shadow: 0 3px 12px rgba(0, 0, 0, 0.2);
        }

        .ken-ai-conversation-item:hover::after {
            content: ' Clique para trocar';
            position: absolute;
            bottom: 2px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.65);
            color: white;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 9px;
            white-space: nowrap;
            z-index: 1000;
            animation: fadeIn 0.2s ease;
        }

        .ken-ai-conversation-item.current {
            border-color: #ffd93d;
            background: rgba(255, 217, 61, 0.15);
            box-shadow: 0 0 10px rgba(255, 217, 61, 0.3);
            position: relative;
        }

        .ken-ai-conversation-item.current::before {
            content: '●';
            position: absolute;
            left: -8px;
            top: 50%;
            transform: translateY(-50%);
            color: #ffd93d;
            font-size: 12px;
            animation: pulse 2s infinite;
        }

        .ken-ai-conversation-item.loading {
            pointer-events: none;
            position: relative;
        }

        .ken-ai-conversation-item.loading::after {
            content: '⏳ Carregando...';
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 10px;
            z-index: 10;
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }

        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        .ken-ai-conversation-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 6px;
        }

        .ken-ai-conversation-date {
            color: #ffd93d;
            font-size: 10px;
            font-weight: 600;
        }

        .ken-ai-conversation-count {
            background: rgba(255, 255, 255, 0.2);
            color: white;
            padding: 2px 6px;
            border-radius: 8px;
            font-size: 8px;
            font-weight: 500;
        }

        .ken-ai-conversation-preview {
            color: rgba(255, 255, 255, 0.9);
            font-size: 11px;
            line-height: 1.3;
            margin-bottom: 6px;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }

        .ken-ai-conversation-actions {
            display: flex;
            gap: 6px;
            justify-content: flex-end;
        }

        .ken-ai-history-action-btn {
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 6px;
            padding: 3px 6px;
            color: rgba(255, 255, 255, 0.8);
            font-size: 9px;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .ken-ai-history-action-btn:hover {
            background: rgba(255, 255, 255, 0.2);
            color: white;
        }

        .ken-ai-history-action-btn.delete:hover {
            background: rgba(255, 107, 107, 0.3);
            color: #ff6b6b;
        }

        .ken-ai-new-chat-btn {
            background: linear-gradient(135deg, #667eea, #764ba2);
            border: none;
            border-radius: 8px;
            padding: 8px 12px;
            color: white;
            font-size: 10px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            margin-top: 10px;
            width: 100%;
        }

        .ken-ai-new-chat-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
        }

        .ken-ai-action-btn {
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 6px;
            padding: 4px 8px;
            color: rgba(255, 255, 255, 0.8);
            font-size: 10px;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .ken-ai-action-btn:hover {
            background: rgba(255, 255, 255, 0.2);
            color: white;
        }

        .ken-ai-action-btn.delete:hover {
            background: rgba(255, 107, 107, 0.3);
            color: #ff6b6b;
        }



        .ken-ai-title {
            color: white;
            font-size: 18px;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .ken-ai-student-name {
            display: inline-block;
            max-width: 220px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            vertical-align: bottom;
        }

        @media (max-width: 520px) {
            .ken-ai-student-name { max-width: 140px; }
        }

        .ken-ai-logo {
            width: 32px;
            height: 32px;
            background: linear-gradient(45deg, #ff6b6b, #ffd93d);
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            color: white;
            font-size: 14px;
        }
        .ken-ai-commands-grid {
         position:relative !important;
         top: 1px !important;
        }

        .ken-ai-close-btn {
            width: 32px;
            height: 32px;
            border: none;
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.1);
            color: white;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
        }

        .ken-ai-close-btn:hover {
            background: rgba(255, 255, 255, 0.2);
            transform: scale(1.05);
        }

        /* Handle de redimensionamento (lateral esquerda, central) */
        /* Botão indicador (grip) para redimensionar */
        .ken-ai-resize-handle {
            position: absolute;
            left: -12px;
            top: 50%;
            transform: translateY(-50%);
            width: 24px;
            height: 48px;
            cursor: col-resize;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(0,0,0,0.25);
            border: 1px solid rgba(255,255,255,0.18);
            border-radius: 12px;
            box-shadow: 0 6px 18px rgba(0,0,0,0.25);
            transition: transform .2s ease, background .2s ease;
        }

        .ken-ai-resize-handle::before {
            content: '';
            width: 10px;
            height: 20px;
            border-radius: 2px;
            background: repeating-linear-gradient(
                to bottom,
                rgba(255,255,255,0.7) 0 2px,
                rgba(255,255,255,0.2) 2px 4px
            );
            opacity: 0.85;
        }

        .ken-ai-resize-handle:hover { background: rgba(0,0,0,0.35); transform: translateY(-50%) scale(1.03); }
        .ken-ai-sidebar-panel.resizing { user-select: none; cursor: col-resize; }

        /* Modal de Configurações */
        .ken-ai-config-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.45);
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 1000001;
        }

        .ken-ai-config-overlay.open { display: flex; }

        .ken-ai-config-modal {
            width: min(720px, 92vw);
            max-height: min(80vh, 720px);
            background: rgba(255,255,255,0.12);
            border: 1px solid rgba(255,255,255,0.2);
            border-radius: 16px;
            backdrop-filter: blur(18px) saturate(120%);
            box-shadow: 0 20px 60px rgba(0,0,0,0.35);
            color: #fff;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        .ken-ai-config-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 14px;
            border-bottom: 1px solid rgba(255,255,255,0.16);
            background: linear-gradient(135deg, rgba(99,102,241,0.35), rgba(139,92,246,0.35));
        }

        .ken-ai-config-title { font-weight: 700; font-size: 14px; }

        .ken-ai-config-body {
            padding: 12px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            overflow: auto;
        }

        .ken-ai-config-section {
            background: rgba(255,255,255,0.08);
            border: 1px solid rgba(255,255,255,0.14);
            border-radius: 12px;
            padding: 10px;
        }

        .ken-ai-config-section h4 {
            margin: 0 0 8px;
            font-size: 12px;
            font-weight: 700;
            color: #ffd93d;
        }

        .ken-ai-input-sm, .ken-ai-textarea-sm, .ken-ai-select-sm {
            width: 100%;
            background: rgba(255,255,255,0.10);
            border: 1px solid rgba(255,255,255,0.18);
            color: #fff;
            border-radius: 10px;
            padding: 8px 10px;
            font-size: 12px;
            outline: none;
        }

        .ken-ai-textarea-sm { min-height: 120px; resize: vertical; }

        .ken-ai-config-footer {
            display: flex;
            justify-content: flex-end;
            gap: 8px;
            padding: 10px;
            border-top: 1px solid rgba(255,255,255,0.16);
            background: rgba(0,0,0,0.15);
        }

        .ken-ai-btn-sm {
            height: 32px;
            padding: 0 12px;
            border-radius: 10px;
            border: 1px solid rgba(255,255,255,0.22);
            background: rgba(255,255,255,0.10);
            color: #fff;
            cursor: pointer;
        }

        .ken-ai-btn-primary {
            background: linear-gradient(135deg, #6d75ff, #8b5cf6);
            border-color: rgba(255,255,255,0.28);
        }



        .ken-ai-chat {
            position: absolute;
            top: 70px; /* abaixo do header */
            left: 0;
            right: 0;
            bottom: 90px; /* acima do input */
            padding: 15px;
            overflow-y: auto;
            overflow-x: hidden;
            display: flex;
            flex-direction: column;
            max-width: 100%;
            box-sizing: border-box;
            word-wrap: break-word;
            word-break: break-word;
            overflow-wrap: break-word;
        }

        .ken-ai-message {
            margin-bottom: 15px;
            animation: fadeInUp 0.3s ease;
            width: 100%;
            display: flex;
        }

        .ken-ai-message.user {
            justify-content: flex-end;
        }

        .ken-ai-message.ai {
            justify-content: flex-start;
        }

        .ken-ai-bubble {
            display: inline-block;
            max-width: 85%;
            padding: 12px 16px;
            border-radius: 16px;
            color: white;
            font-size: 13px;
            line-height: 1.4;
            word-wrap: break-word;
            word-break: break-word;
            overflow-wrap: break-word;
            hyphens: auto;
            width: fit-content;
            overflow: hidden;
            box-sizing: border-box;
        }

        .ken-ai-message.user .ken-ai-bubble {
            background: rgba(255, 255, 255, 0.2);
            border-bottom-right-radius: 4px;
            max-width: 85%;
            overflow: hidden;
        }

        .ken-ai-message.ai .ken-ai-bubble {
            background: rgba(0, 0, 0, 0.2);
            border-bottom-left-radius: 4px;
            width: fit-content;
            max-width: 85%;
            overflow: hidden;
        }

        .ken-ai-input-area {
            position: absolute;
            left: 0;
            right: 0;
            bottom: 0;
            width: auto;
            margin: 0;
            padding: 16px;
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(20px);
            border-top: 1px solid rgba(255, 255, 255, 0.15);
            z-index: 1;
            border-top-left-radius: 20px;
            border-top-right-radius: 20px;
            transition: padding 0.3s ease;
        }

        .ken-ai-input-container {
            display: flex;
            gap: 8px;
            align-items: flex-end;
        }

        .ken-ai-input-wrapper {
            flex: 1;
            position: relative;
            display: flex;
            flex-direction: column;
        }

        .ken-ai-input {
            width: 90%;
            height: 40px !important;
    min-height: 40px !important;
    max-height: 40px !important;
            padding: 10px 15px;
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 25px; /* Deixar mais arredondado */
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            color: white;
            font-size: 13px;
            font-family: 'Inter', sans-serif;
            resize: none;
            outline: none;
            transition: all 0.2s ease;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1); /* Adicionar sombra sutil */
        }

        .ken-ai-input:focus {
            border-color: rgba(255, 255, 255, 0.4);
            background: rgba(255, 255, 255, 0.15);
            box-shadow: 0 4px 10px rgba(0,0,0,0.15); /* Sombra mais pronunciada no foco */
        }

        .ken-ai-input::placeholder {
            color: rgba(255, 255, 255, 0.6);
        }

        .ken-ai-action-btn {
            width: 36px;
            height: 36px;
            border: none;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.15);
            color: white;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
            font-size: 14px;
        }

        .ken-ai-action-btn:hover {
            background: rgba(255, 255, 255, 0.25);
            transform: scale(1.05);
        }

        .ken-ai-action-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none;
        }

        .ken-ai-send-btn {
            background: linear-gradient(135deg, #ff6b6b, #ffd93d);
        }

        .ken-ai-send-btn:hover {
            background: linear-gradient(135deg, #ff5252, #ffcc02);
            box-shadow: 0 4px 12px rgba(255, 107, 107, 0.3);
        }

        .ken-ai-floating-btn {
            position: fixed;
            top: 50%;
            right: 20px;
            transform: translateY(-50%);
            width: 50px;
            height: 50px;
            border: none;
            border-radius: 50%;
            background: linear-gradient(135deg, #6366f1, #8b5cf6);
            color: white;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            box-shadow: 0 8px 25px rgba(99, 102, 241, 0.4);
            z-index: 999998;
            transition: all 0.3s ease;
        }

        .ken-ai-floating-btn:hover {
            transform: translateY(-50%) scale(1.1);
            box-shadow: 0 12px 35px rgba(99, 102, 241, 0.6);
        }

        .ken-ai-status {
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, #6366f1, #8b5cf6);
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            font-family: 'Inter', sans-serif;
            font-size: 14px;
            z-index: 1000000;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            animation: fadeInOut 2s ease;
        }

        @keyframes fadeInOut {
            0% { opacity: 0; transform: translate(-50%, -20px); }
            20% { opacity: 1; transform: translate(-50%, 0); }
            80% { opacity: 1; transform: translate(-50%, 0); }
            100% { opacity: 0; transform: translate(-50%, -20px); }
        }

        .ken-ai-floating-btn.panel-open {
            right: 420px;
        }

        .ken-ai-file-input {
            display: none;
        }

        .ken-ai-voice-btn.listening {
            background: #ff6b6b !important;
            animation: pulse 1.5s infinite;
        }

        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.1); }
            100% { transform: scale(1); }
        }

        .ken-ai-loading {
            display: flex;
            align-items: center;
            gap: 8px;
            color: rgba(255, 255, 255, 0.8);
            font-size: 12px;
        }

        .ken-ai-spinner {
            width: 16px;
            height: 16px;
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-top: 2px solid white;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        .ken-ai-file-preview {
            background: rgba(0, 0, 0, 0.2);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 8px;
            padding: 8px;
            position: relative;
            bottom: 15px;
           /* margin-bottom: 10px; */
            color: white;
            font-size: 11px;
            width: 100%;
        }

        .ken-ai-file-preview img {
            max-width: 100%;
            max-height: 80px;
            border-radius: 4px;
            margin-top: 4px;
        }

        .markdown-content {
            color: white;
            max-width: 100%;
            overflow: hidden;
            word-wrap: break-word;
            word-break: break-word;
            overflow-wrap: break-word;
        }

        .markdown-content h1, .markdown-content h2, .markdown-content h3 {
            color: #ffd93d;
            margin: 8px 0 6px 0;
            font-size: 14px;
            word-wrap: break-word;
            overflow: hidden;
        }

        .markdown-content p {
            margin-bottom: 8px;
            line-height: 1.5;
            word-wrap: break-word;
            word-break: break-word;
            overflow-wrap: break-word;
        }

        .markdown-content code {
            background: rgba(0, 0, 0, 0.3);
            padding: 2px 4px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
            font-size: 11px;
            word-break: break-all;
            overflow-wrap: break-word;
            max-width: 100%;
            display: inline-block;
        }

        .markdown-content pre {
            background: rgba(0, 0, 0, 0.3);
            padding: 10px;
            border-radius: 6px;
            overflow-x: auto;
            margin: 8px 0;
            font-size: 11px;
            max-width: 100%;
            box-sizing: border-box;
            white-space: pre-wrap;
            word-wrap: break-word;
        }

        .markdown-content ul, .markdown-content ol {
            padding-left: 16px;
            margin: 6px 0;
            max-width: 100%;
            overflow: hidden;
        }

        .markdown-content li {
            margin-bottom: 3px;
            word-wrap: break-word;
            word-break: break-word;
            overflow-wrap: break-word;
        }

        .math-content {
            background: rgba(0, 0, 0, 0.2);
            padding: 6px;
            border-radius: 4px;
            margin: 6px 0;
            font-family: 'Courier New', monospace;
            font-size: 11px;
        }

        .math-display {
            background: rgba(0, 0, 0, 0.15);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            padding: 15px;
            margin: 10px 0;
            text-align: center;
            overflow-x: auto;
        }

        .math-inline {
            background: rgba(0, 0, 0, 0.1);
            padding: 2px 4px;
            border-radius: 3px;
            margin: 0 2px;
        }

        /* Estilos para KaTeX */
        .katex {
            color: white !important;
        }

        .katex .base {
            color: white !important;
        }

        .katex-display {
            margin: 10px 0 !important;
            text-align: center !important;
        }

        .katex-display > .katex {
            display: inline-block !important;
            white-space: nowrap !important;
        }

        /* Regras para evitar vazamento de conteúdo (EXCETO KaTeX) */
        .ken-ai-bubble table {
            width: 100% !important;
            max-width: 100% !important;
            table-layout: fixed !important;
            word-wrap: break-word !important;
        }

        .ken-ai-bubble td, .ken-ai-bubble th {
            word-wrap: break-word !important;
            word-break: break-word !important;
            overflow-wrap: break-word !important;
            max-width: 0 !important;
        }

        /* Imagens e mídia */
        .ken-ai-bubble img {
            max-width: 100% !important;
            height: auto !important;
            object-fit: contain !important;
        }

        /* Links longos */
        .ken-ai-bubble a {
            word-break: break-all !important;
            overflow-wrap: break-word !important;
        }

        /* Código (não matemático) */
        .ken-ai-bubble code:not(.katex *) {
            word-break: break-all !important;
            overflow-wrap: break-word !important;
            max-width: 100% !important;
        }

        /* Texto longo sem espaços (não matemático) */
        .ken-ai-bubble p, .ken-ai-bubble div:not(.katex):not(.katex-display) {
            word-wrap: break-word !important;
            word-break: break-word !important;
            overflow-wrap: break-word !important;
        }

        /* Fallback para MathJax se ainda estiver sendo usado */
        .math-display mjx-container,
        .math-inline mjx-container {
            color: white !important;
        }

        .math-display mjx-container svg,
        .math-inline mjx-container svg {
            color: white !important;
            fill: white !important;
        }

        /* Scrollbar padrão para chat */
        .ken-ai-chat::-webkit-scrollbar {
            width: 8px;
        }

        .ken-ai-chat::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 4px;
        }

        .ken-ai-chat::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.3);
            border-radius: 4px;
        }

        .ken-ai-chat::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.5);
        }

        .ken-ai-welcome {
            text-align: center;
            padding: 25px 15px;
            background: linear-gradient(135deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.06));
            border-radius: 15px;
            position: relative;
            overflow: hidden;
            margin-bottom: 10px;
        }

        .ken-ai-welcome::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle, rgba(255, 217, 61, 0.1) 0%, transparent 70%);
            animation: welcomeGlow 4s ease-in-out infinite alternate;
            pointer-events: none;
        }

        @keyframes welcomeGlow {
            0% { transform: scale(0.8) rotate(0deg); opacity: 0.3; }
            100% { transform: scale(1.2) rotate(180deg); opacity: 0.1; }
        }

        .ken-ai-welcome-content {
            position: relative;
            z-index: 2;
        }

        .ken-ai-welcome-header {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            margin-bottom: 15px;
        }

        .ken-ai-avatar {
            width: 45px;
            height: 45px;
            background: linear-gradient(135deg, #667eea, #764ba2);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            animation: avatarPulse 2s ease-in-out infinite;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
        }

        @keyframes avatarPulse {
            0%, 100% { transform: scale(1); box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3); }
            50% { transform: scale(1.05); box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5); }
        }

        .ken-ai-welcome h3 {
            color: #ffd93d;
            margin: 0;
            font-size: 18px;
            font-weight: 700;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        }

        .ken-ai-welcome-subtitle {
            color: rgba(255, 255, 255, 0.8);
            font-size: 11px;
            margin-bottom: 15px;
            font-style: italic;
        }

        .ken-ai-welcome p {
            color: rgba(255, 255, 255, 0.9);
            font-size: 12px;
            line-height: 1.5;
            margin-bottom: 10px;
        }

        .ken-ai-features {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
            margin-top: 15px;
        }

        .ken-ai-feature {
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            padding: 8px;
            text-align: left;
            transition: all 0.3s ease;
        }

        .ken-ai-feature:hover {
            background: rgba(255, 255, 255, 0.12);
            transform: translateY(-2px);
        }

        .ken-ai-feature-icon {
            font-size: 14px;
            margin-bottom: 4px;
            display: block;
        }

        .ken-ai-feature-title {
            color: #ffd93d;
            font-size: 10px;
            font-weight: 600;
            margin-bottom: 2px;
        }

        .ken-ai-feature-desc {
            color: rgba(255, 255, 255, 0.7);
            font-size: 8px;
            line-height: 1.3;
        }

        .ken-ai-image-preview-container {
            position: absolute;
            bottom: 100%;
            left: 0;
            right: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
            max-width: 100%;
            overflow-x: auto;
            padding: 10px;
            background: transparent;
        }

        .ken-ai-image-preview {
            position: relative;
            width: 80px;
            height: 80px;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            transition: transform 0.2s ease;
        }

        .ken-ai-image-preview img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }

        .ken-ai-image-preview-remove {
            position: absolute;
            top: 5px;
            right: 5px;
            background: rgba(0,0,0,0.5);
            color: white;
            border: none;
            border-radius: 50%;
            width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            font-size: 12px;
            z-index: 10;
        }

        .ken-ai-image-preview:hover {
            transform: scale(1.05);
        }

        .ken-ai-image-limit-message {
            width: 60%;
            text-align: center;
            color: #ffd93d;
            font-size: 12px;
            padding: 10px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            margin-bottom: 10px;
            animation: fadeInUp 0.3s ease;
        }

        .ken-ai-image-preview-wrapper {
    display: flex;
    justify-content: center;
    background: rgba(255, 255, 255, 0.1);
    padding: 10px 0px;
    border-radius: 10px;
    gap: 10px;
    width: 70%;
}

        .ken-ai-commands-menu {
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 20px;
            padding: 15px;
            margin: 20px 0 25px 0;
            backdrop-filter: blur(10px);
            position: relative;
            overflow: hidden;
            height: 120px;
        }

        .ken-ai-commands-title {
            color: #ffd93d;
            font-size: 11px;
            font-weight: 600;
            margin-bottom: 12px;
            text-align: center;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
        }

        .ken-ai-commands-grid {
          display: flex;
    position: relative;
    bottom: 25px !important;
    grid-template-columns: repeat(3, 1fr);
    grid-template-rows: repeat(2, 1fr);
    gap: 5px;
    height: 75px;
    flex-direction: row;
    flex-wrap: nowrap;
    justify-content: space-around;
    align-content: center;
    align-items: flex-start;
        }

        .ken-ai-command-item {
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            cursor: pointer;
            width: 55px !important;
            transition: all 0.3s ease;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 4px;
            position: relative;
            overflow: hidden;
            text-align: center;
            padding: 6px;
            animation: slideHorizontal 15s linear infinite;
        }

        .ken-ai-command-item:hover {
            background: rgba(255, 255, 255, 0.2);
            border-color: rgba(255, 255, 255, 0.3);
            transform: scale(1.05);
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
            z-index: 10;
            animation-play-state: paused;
        }

        @keyframes slideHorizontal {
            0% { transform: translateX(0); }
            50% { transform: translateX(10px); }
            100% { transform: translateX(0); }
        }

        .ken-ai-command-icon {
            color: #ffd93d;
            font-size: 16px;
            transition: all 0.3s ease;
            flex-shrink: 0;
        }

        .ken-ai-command-name {
            color: white;
            font-size: 9px;
            font-weight: 600;
            line-height: 1;
            text-align: center;
            white-space: nowrap;
        }

        .ken-ai-command-item:hover .ken-ai-command-icon {
            color: white;
            transform: scale(1.1);
        }

        .ken-ai-command-item:hover .ken-ai-command-name {
            color: #ffd93d;
        }

        .ken-ai-command-shortcut {
            background: rgba(0, 0, 0, 0.3);
            color: #ffd93d;
            padding: 4px 8px;
            border-radius: 6px;
            font-size: 10px;
            font-weight: 500;
            font-family: 'Courier New', monospace;
        }

        .ken-ai-input.command-inserted {
            animation: commandInserted 0.6s ease;
            border-color: #ffd93d !important;
        }

        @keyframes commandInserted {
            0% {
                border-color: #ffd93d;
                box-shadow: 0 0 0 0 rgba(255, 217, 61, 0.4);
            }
            50% {
                border-color: #ffd93d;
                box-shadow: 0 0 0 8px rgba(255, 217, 61, 0.1);
            }
            100% {
                border-color: rgba(255, 255, 255, 0.4);
                box-shadow: 0 0 0 0 rgba(255, 217, 61, 0);
            }
        }

.ken-ai-commands-title {
    bottom: 15px;
    position: relative;
}

.ken-ai-commands-carousel {
     position: relative;
    top: -40px;
}
.ken-ai-commands-track {
    position: relative;
    top: 11px !important;
}

/* Estilos para o menu AI de seleção */
.ken-ai-menu-item {
    padding: 10px 15px;
    cursor: pointer;
    transition: all 0.2s ease;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    font-weight: 500;
    color: white;
}

.ken-ai-menu-item:last-child {
    border-bottom: none;
}

.ken-ai-menu-item:hover {
    background: rgba(255, 255, 255, 0.15);
    color: #ffd93d;
}

.ken-ai-menu-item i {
    width: 16px;
    text-align: center;
    color: #ffd93d;
    transition: all 0.2s ease;
}

.ken-ai-menu-item:hover i {
    color: white;
    transform: scale(1.1);
}

/* Animação para o dropdown */
@keyframes fadeInDown {
    from {
        opacity: 0;
        transform: translateY(-10px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

#kenAiMenuDropdown {
    animation: fadeInDown 0.2s ease-out;
}

/* Estilo para o ícone de seta do dropdown */
.ken-ai-dropdown-arrow {
    transition: transform 0.2s ease;
}

.ken-ai-menu-open .ken-ai-dropdown-arrow {
    transform: rotate(180deg);
}

/* Animações para o Mini KEN Chat */
@keyframes miniChatSlideIn {
    from {
        opacity: 0;
        transform: translate(-50%, -50%) scale(0.8);
    }
    to {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1);
    }
}

@keyframes miniChatSlideOut {
    from {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1);
    }
    to {
        opacity: 0;
        transform: translate(-50%, -50%) scale(0.8);
    }
}

/* Scrollbar do mini chat - VISÍVEL */
#miniChatMessages {
    overflow-y: auto !important;
    overflow-x: hidden !important;
    max-height: 380px !important;
    padding: 15px !important;
}

#miniChatMessages::-webkit-scrollbar {
    width: 8px !important;
}

#miniChatMessages::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.1) !important;
    border-radius: 4px !important;
}

#miniChatMessages::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.4) !important;
    border-radius: 4px !important;
}

#miniChatMessages::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.6) !important;
}

/* Mensagens do mini chat - tamanho normal */
#miniChatMessages > div {
    margin-bottom: 10px !important;
    padding: 10px !important;
    border-radius: 10px !important;
    font-size: 13px !important;
    line-height: 1.4 !important;
    word-wrap: break-word !important;
    min-height: auto !important;
    color: white !important;
}

/* Mensagens específicas do mini chat */
.mini-chat-message {
    margin-bottom: 10px !important;
    padding: 10px !important;
    font-size: 13px !important;
    line-height: 1.4 !important;
    word-wrap: break-word !important;
    color: white !important;
}

/* Conteúdo matemático no mini chat */
#miniChatMessages .katex,
#miniChatMessages .katex-display {
    font-size: 1em !important;
    color: white !important;
}

/* Garantir que todas as mensagens do mini chat sejam visíveis */
#miniChatMessages * {
    font-size: inherit !important;
    color: white !important;
    visibility: visible !important;
    opacity: 1 !important;
}

/* Mensagens de loading e resposta da IA no mini chat */
#miniChatMessages .loading-message,
#miniChatMessages .ai-response {
    padding: 10px !important;
    margin-bottom: 10px !important;
    border-radius: 10px !important;
    background: rgba(255, 255, 255, 0.1) !important;
    font-size: 13px !important;
    line-height: 1.4 !important;
    color: white !important;
}

/* Animação para backdrop */
@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

/* Animações para mensagens do mini chat */
@keyframes slideInRight {
    from {
        opacity: 0;
        transform: translateX(20px);
    }
    to {
        opacity: 1;
        transform: translateX(0);
    }
}

@keyframes slideInLeft {
    from {
        opacity: 0;
        transform: translateX(-20px);
    }
    to {
        opacity: 1;
        transform: translateX(0);
    }
}

/* Estilos para drag and drop de imagens */
.mini-chat-drag-over {
    background: rgba(255, 217, 61, 0.2) !important;
    border-top: 2px dashed #ffd93d !important;
}

.mini-chat-image-preview {
    transition: transform 0.2s ease;
}

.mini-chat-image-preview:hover {
    transform: scale(1.05);
}

.mini-chat-limit-message {
    background: rgba(255, 107, 107, 0.2) !important;
    border: 1px solid #ff6b6b !important;
    border-radius: 8px !important;
    padding: 8px 12px !important;
    color: #ff6b6b !important;
    font-size: 11px !important;
    text-align: center !important;
    margin-bottom: 8px !important;
    animation: fadeInUp 0.3s ease !important;
    order: -1 !important;
}

.mini-chat-images-container {
    display: flex !important;
    flex-wrap: wrap !important;
    gap: 8px !important;
    justify-content: center !important;
}

/* Scrollbar invisível APENAS para inputs */
.ken-ai-input::-webkit-scrollbar,
textarea.ken-ai-input::-webkit-scrollbar,
#miniChatInput::-webkit-scrollbar {
    width: 0px !important;
    background: transparent !important;
}

.ken-ai-input::-webkit-scrollbar-track,
textarea.ken-ai-input::-webkit-scrollbar-track,
#miniChatInput::-webkit-scrollbar-track {
    background: transparent !important;
}

.ken-ai-input::-webkit-scrollbar-thumb,
textarea.ken-ai-input::-webkit-scrollbar-thumb,
#miniChatInput::-webkit-scrollbar-thumb {
    background: transparent !important;
}

/* Para Firefox - scrollbar invisível APENAS para inputs */
.ken-ai-input,
textarea.ken-ai-input,
#miniChatInput {
    scrollbar-width: none !important;
}
`;

  // Adicionar estilos para o botão flutuante
  stylesContent += `
        .ken-ai-floating-btn {
            position: fixed;
            top: 50%;
            right: 20px;
            transform: translateY(-50%);
            width: 50px;
            height: 50px;
            border: none;
            border-radius: 50%;
            background: linear-gradient(135deg, #6366f1, #8b5cf6);
            color: white;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            box-shadow: 0 8px 25px rgba(99, 102, 241, 0.4);
            z-index: 999998;
            transition: all 0.3s ease;
        }

        .ken-ai-floating-btn:hover {
            transform: translateY(-50%) scale(1.1);
            box-shadow: 0 12px 35px rgba(99, 102, 241, 0.6);
        }

        .ken-ai-floating-btn.panel-open {
            right: 520px;
        }
    `;

  // Adicionar estilos
  const styleSheet = document.createElement('style');
  styleSheet.textContent = stylesContent;
  document.head.appendChild(styleSheet);

  // Adicionar estilos para redimensionamento
  stylesContent += `
        .ken-ai-resize-handle {
            position: absolute;
            top: 0;
            bottom: 0;
            left: -5px;
            width: 10px;
            cursor: col-resize;
            z-index: 1000001;
            background: transparent;
        }
    `;

  // Obter nome do usuário a partir do sessionStorage.user_profile_graphql_ (dois primeiros nomes)
  function getUserNameFromSession() {
    try {
      const key = Object.keys(sessionStorage).find(k => k.startsWith('user_profile_graphql_'));
      if (!key) return 'Estudante';
      const raw = sessionStorage.getItem(key);
      const data = JSON.parse(raw);
      if (data && typeof data.name === 'string' && data.name.trim().length > 0) {
        const parts = data.name.trim().split(/\s+/);
        return parts.slice(0, 2).join(' ');
      }
    } catch (error) {
      console.warn("Falha ao obter 'name' de sessionStorage.user_profile_graphql_*:", error);
    }
    return 'Estudante';
  }

  // HTML do painel lateral
  async function createPanelHTML() {
    // Buscar nome do estudante
    const studentName = getUserNameFromSession();

    return `
    <div class="ken-ai-sidebar-panel" id="kenAiPanel">
        <div class="ken-ai-resize-handle" id="kenAiResizeHandle" title="Arraste para redimensionar (col-resize)"></div>
      <div class="ken-ai-header">
        <div class="ken-ai-title">
          <div class="ken-ai-logo">KEN</div>
          <span title="${studentName}">Study AI - <span class="ken-ai-student-name" id="kenAiStudentName">${studentName}</span></span>
        </div>
        <div class="ken-ai-header-actions">
          <div class="ken-ai-toolbar">
            <div class="ken-ai-new-chat-container">
              <button class="ken-ai-new-chat-btn" onclick="startNewChat()" title="Novo chat">
                <i class="fas fa-plus" aria-hidden="true"></i>
                <span class="btn-label">Novo Chat</span>
              </button>
            </div>
            <!-- Espaço reservado para futuros botões na head -->
            <button class="ken-ai-icon-btn" id="kenAiHistory" title="Histórico" aria-label="Histórico">
              <i class="fas fa-clock"></i>
            </button>
            <button class="ken-ai-icon-btn" id="kenAiSettings" title="Configurações" aria-label="Configurações">
              <i class="fas fa-gear"></i>
            </button>
          </div>
          <button class="ken-ai-close-btn" id="kenAiClose" title="Fechar painel" aria-label="Fechar">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>

        <!-- Modal de Configurações -->
        <div class="ken-ai-config-overlay" id="kenAiConfigOverlay" aria-hidden="true">
          <div class="ken-ai-config-modal" role="dialog" aria-modal="true" aria-labelledby="kenAiConfigTitle">
            <div class="ken-ai-config-header">
              <div class="ken-ai-config-title" id="kenAiConfigTitle">Configurações</div>
              <button class="ken-ai-icon-btn" id="kenAiConfigClose" title="Fechar"><i class="fas fa-times"></i></button>
            </div>
            <div class="ken-ai-config-body">
              <div class="ken-ai-config-section">
                <h4>Prompt do KEN AI</h4>
                <textarea id="kenAiSystemPrompt" class="ken-ai-textarea-sm" placeholder="Defina o comportamento do KEN AI (sistema)"></textarea>
              </div>
              <div class="ken-ai-config-section">
                <h4>Prompt do KEN Mini</h4>
                <textarea id="kenMiniSystemPrompt" class="ken-ai-textarea-sm" placeholder="Defina o comportamento do Mini KEN"></textarea>
              </div>
              <div class="ken-ai-config-section">
                <h4>Configurações de Saída</h4>
                <label style="font-size:12px; opacity:.9; display:block; margin-bottom:6px;">Formato preferido</label>
                <select id="kenAiPreferredFormat" class="ken-ai-select-sm">
                  <option value="markdown">Markdown</option>
                  <option value="lista">Lista</option>
                  <option value="tabela">Tabela</option>
                </select>
              </div>
              <div class="ken-ai-config-section">
                <h4>Modelo e Temperatura</h4>
                <label style="font-size:12px; opacity:.9; display:block; margin-bottom:6px;">Temperatura</label>
                <input id="kenAiTemperature" type="range" min="0" max="1" step="0.1" class="ken-ai-input-sm" />
                <div id="kenAiTemperatureValue" style="font-size:12px; opacity:.9; margin-top:4px;">0.7</div>
              </div>
            </div>
            <div class="ken-ai-config-footer">
              <button class="ken-ai-btn-sm" id="kenAiConfigCancel">Cancelar</button>
              <button class="ken-ai-btn-sm ken-ai-btn-primary" id="kenAiConfigSave">Salvar</button>
            </div>
          </div>
        </div>

      <div class="ken-ai-chat" id="kenAiChat">
        <div class="ken-ai-welcome">
          <div class="ken-ai-welcome-content">
            <div class="ken-ai-welcome-header">
              <div class="ken-ai-avatar"><i class="fas fa-robot"></i></div>
              <h3>Olá, <span id="kenAiWelcomeName">${studentName}</span>!</h3>
            </div>
            <div class="ken-ai-welcome-subtitle">Seu Assistente de Estudos Inteligente</div>
            <p>Estou aqui para transformar sua experiência de aprendizado! Com IA avançada, posso ajudar você a:</p>

            <div class="ken-ai-features">
              <div class="ken-ai-feature">
                <span class="ken-ai-feature-icon"><i class="fas fa-search"></i></span>
                <div class="ken-ai-feature-title">Analisar Páginas</div>
                <div class="ken-ai-feature-desc">Compreendo qualquer conteúdo web</div>
              </div>
              <div class="ken-ai-feature">
                <span class="ken-ai-feature-icon"><i class="fas fa-book"></i></span>
                <div class="ken-ai-feature-title">Explicar Conceitos</div>
                <div class="ken-ai-feature-desc">Torno complexo em simples</div>
              </div>
              <div class="ken-ai-feature">
                <span class="ken-ai-feature-icon"><i class="fas fa-calculator"></i></span>
                <div class="ken-ai-feature-title">Resolver Matemática</div>
                <div class="ken-ai-feature-desc">Fórmulas e cálculos detalhados</div>
              </div>
              <div class="ken-ai-feature">
                <span class="ken-ai-feature-icon"><i class="fas fa-bullseye"></i></span>
                <div class="ken-ai-feature-title">Criar Quizzes</div>
                <div class="ken-ai-feature-desc">Teste seus conhecimentos</div>
              </div>
            </div>

            <p style="margin-top: 15px; font-size: 11px; opacity: 0.8;">
               <strong>Dica:</strong> Use os comandos abaixo ou digite sua pergunta diretamente!
            </p>
          </div>
        </div>

        <div class="ken-ai-commands-menu" id="kenAiCommandsMenu">
          <div class="ken-ai-commands-title">
            Comandos Rápidos
          </div>
          <div class="ken-ai-commands-grid">
            <!-- Linha superior (3 comandos) -->
            <div class="ken-ai-command-item" onclick="insertCommand('/search-pag ')">
              <div class="ken-ai-command-icon">
                <i class="fas fa-search"></i>
              </div>
              <div class="ken-ai-command-name">Analisar</div>
            </div>

            <div class="ken-ai-command-item" onclick="insertCommand('Resuma: ')">
              <div class="ken-ai-command-icon">
                <i class="fas fa-compress-alt"></i>
              </div>
              <div class="ken-ai-command-name">Resumir</div>
            </div>

            <div class="ken-ai-command-item" onclick="insertCommand('Explique: ')">
              <div class="ken-ai-command-icon">
                <i class="fas fa-lightbulb"></i>
              </div>
              <div class="ken-ai-command-name">Explicar</div>
            </div>

            <!-- Linha inferior (3 comandos) -->
            <div class="ken-ai-command-item" onclick="insertCommand('Quiz sobre: ')">
              <div class="ken-ai-command-icon">
                <i class="fas fa-question-circle"></i>
              </div>
              <div class="ken-ai-command-name">Quiz</div>
            </div>

            <div class="ken-ai-command-item" onclick="insertCommand('Traduza: ')">
              <div class="ken-ai-command-icon">
                <i class="fas fa-language"></i>
              </div>
              <div class="ken-ai-command-name">Traduzir</div>
            </div>

            <div class="ken-ai-command-item" onclick="insertCommand('Resolva: ')">
              <div class="ken-ai-command-icon">
                <i class="fas fa-calculator"></i>
              </div>
              <div class="ken-ai-command-name">Matemática</div>
            </div>
          </div>
        </div>
      </div>

      <div class="ken-ai-input-area">
        <div class="ken-ai-image-preview-container" id="kenAiImagePreviewContainer" style="display: none;"></div>
        <div class="ken-ai-input-container">
          <input type="file" id="kenAiFileInput" class="ken-ai-file-input" accept="image/*,audio/*,.txt,.pdf" multiple>
          <button class="ken-ai-action-btn" onclick="document.getElementById('kenAiFileInput').click()" title="Anexar">
            <i class="fas fa-paperclip"></i>
          </button>
          <button class="ken-ai-action-btn ken-ai-voice-btn" id="kenAiVoiceBtn" title="Voz">
            <i class="fas fa-microphone"></i>
          </button>
          <div class="ken-ai-input-wrapper">
            <textarea id="kenAiInput" class="ken-ai-input" placeholder="  Digite sua dúvida..." rows="1"></textarea>
            <div id="kenAiFilePreview" class="ken-ai-file-preview" style="display: none;"></div>
          </div>
          <button class="ken-ai-action-btn ken-ai-send-btn" id="kenAiSendBtn" title="Enviar">
            <i class="fas fa-paper-plane"></i>
          </button>
        </div>
      </div>
    </div>
  `;
  }

  // Criar painel principal (função assíncrona)
  async function initializePanel() {
    try {
      // Criar container do painel
      const panelContainer = document.createElement('div');

      // Em vez de usar innerHTML, vamos criar o elemento principal e adicioná-lo
      const panelHTML = await createPanelHTML();

      // Criar um elemento temporário para parsear o HTML
      const tempDiv = document.createElement('div');

      // Usar uma abordagem alternativa para adicionar o conteúdo
      // Isso contorna a restrição de TrustedHTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(panelHTML, 'text/html');
      const panelElement = doc.body.firstChild;

      // Se o parsing funcionou, adicionar o elemento ao DOM
      if (panelElement) {
        panelContainer.appendChild(panelElement);
        document.body.appendChild(panelContainer);
      } else {
        // Fallback: Criar manualmente os elementos principais
        console.warn('Usando método alternativo para criar o painel devido a restrições de CSP');
        createPanelManually();
      }

      // Inicializar elementos DOM após criar o painel
      initializeDOMElements();
    } catch (error) {
      console.error('Erro ao inicializar painel:', error);
      // Fallback: Criar manualmente os elementos principais
      createPanelManually();
      initializeDOMElements();
    }
  }

  // Função para criar o painel manualmente (contornando restrições de CSP)
  function createPanelManually() {
    try {
      // Criar container principal
      const panelContainer = document.createElement('div');

      // Criar painel
      const panel = document.createElement('div');
      panel.className = 'ken-ai-sidebar-panel';
      panel.id = 'kenAiPanel';

      // Criar header
      const header = document.createElement('div');
      header.className = 'ken-ai-header';

      // Criar título
      const title = document.createElement('div');
      title.className = 'ken-ai-title';

      // Logo
      const logo = document.createElement('div');
      logo.className = 'ken-ai-logo';
      logo.textContent = 'KEN';

      // Nome do estudante
      const nameSpan = document.createElement('span');
      nameSpan.textContent = 'Study AI';

      // Botão de fechar
      const closeBtn = document.createElement('button');
      closeBtn.className = 'ken-ai-close-btn';
      closeBtn.id = 'kenAiClose';

      const closeIcon = document.createElement('i');
      closeIcon.className = 'fas fa-times';
      closeBtn.appendChild(closeIcon);

      // Montar header
      title.appendChild(logo);
      title.appendChild(nameSpan);
      header.appendChild(title);
      header.appendChild(closeBtn);

      // Criar área de chat
      const chat = document.createElement('div');
      chat.className = 'ken-ai-chat';
      chat.id = 'kenAiChat';

      // Criar área de input
      const inputArea = document.createElement('div');
      inputArea.className = 'ken-ai-input-area';

      // Container de preview de imagem
      const imagePreviewContainer = document.createElement('div');
      imagePreviewContainer.className = 'ken-ai-image-preview-container';
      imagePreviewContainer.id = 'kenAiImagePreviewContainer';
      imagePreviewContainer.style.display = 'none';

      // Container de input
      const inputContainer = document.createElement('div');
      inputContainer.className = 'ken-ai-input-container';

      // Input de arquivo
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.id = 'kenAiFileInput';
      fileInput.className = 'ken-ai-file-input';
      fileInput.accept = 'image/*,audio/*,.txt,.pdf';
      fileInput.multiple = true;

      // Botão de anexo
      const attachBtn = document.createElement('button');
      attachBtn.className = 'ken-ai-action-btn';
      attachBtn.title = 'Anexar';
      attachBtn.onclick = function () { document.getElementById('kenAiFileInput').click(); };

      const attachIcon = document.createElement('i');
      attachIcon.className = 'fas fa-paperclip';
      attachBtn.appendChild(attachIcon);

      // Botão de voz
      const voiceBtn = document.createElement('button');
      voiceBtn.className = 'ken-ai-action-btn ken-ai-voice-btn';
      voiceBtn.id = 'kenAiVoiceBtn';
      voiceBtn.title = 'Voz';

      const voiceIcon = document.createElement('i');
      voiceIcon.className = 'fas fa-microphone';
      voiceBtn.appendChild(voiceIcon);

      // Wrapper do input
      const inputWrapper = document.createElement('div');
      inputWrapper.className = 'ken-ai-input-wrapper';

      // Textarea
      const textarea = document.createElement('textarea');
      textarea.id = 'kenAiInput';
      textarea.className = 'ken-ai-input';
      textarea.placeholder = '  Digite sua dúvida...';
      textarea.rows = 1;

      // Preview de arquivo
      const filePreview = document.createElement('div');
      filePreview.id = 'kenAiFilePreview';
      filePreview.className = 'ken-ai-file-preview';
      filePreview.style.display = 'none';

      // Botão de enviar
      const sendBtn = document.createElement('button');
      sendBtn.className = 'ken-ai-action-btn ken-ai-send-btn';
      sendBtn.id = 'kenAiSendBtn';
      sendBtn.title = 'Enviar';

      const sendIcon = document.createElement('i');
      sendIcon.className = 'fas fa-paper-plane';
      sendBtn.appendChild(sendIcon);

      // Montar componentes
      inputWrapper.appendChild(textarea);
      inputWrapper.appendChild(filePreview);

      inputContainer.appendChild(fileInput);
      inputContainer.appendChild(attachBtn);
      inputContainer.appendChild(voiceBtn);
      inputContainer.appendChild(inputWrapper);
      inputContainer.appendChild(sendBtn);

      inputArea.appendChild(imagePreviewContainer);
      inputArea.appendChild(inputContainer);

      // Montar painel
      panel.appendChild(header);
      panel.appendChild(chat);
      panel.appendChild(inputArea);

      // Adicionar ao DOM
      panelContainer.appendChild(panel);
      document.body.appendChild(panelContainer);
    } catch (error) {
      console.error('Erro ao criar painel manualmente:', error);
    }
  }

  // Função para inicializar elementos DOM
  function initializeDOMElements() {
    // Elementos DOM
    const panel = document.getElementById('kenAiPanel');
    const closeBtn = document.getElementById('kenAiClose');
    const chat = document.getElementById('kenAiChat');
    const input = document.getElementById('kenAiInput');
    const sendBtn = document.getElementById('kenAiSendBtn');
    const settingsBtn = document.getElementById('kenAiSettings');
    const configOverlay = document.getElementById('kenAiConfigOverlay');
    const configClose = document.getElementById('kenAiConfigClose');
    const configCancel = document.getElementById('kenAiConfigCancel');
    const configSave = document.getElementById('kenAiConfigSave');
    const systemPromptEl = document.getElementById('kenAiSystemPrompt');
    const miniPromptEl = document.getElementById('kenMiniSystemPrompt');
    const preferredFormatEl = document.getElementById('kenAiPreferredFormat');
    const temperatureEl = document.getElementById('kenAiTemperature');
    const temperatureValueEl = document.getElementById('kenAiTemperatureValue');

    // Carregar configurações salvas
    function loadConfig() {
      try {
        const cfg = JSON.parse(localStorage.getItem('kenAiConfig') || '{}');
        systemPromptEl && (systemPromptEl.value = cfg.systemPrompt || promptTemplates?.general?.system || '');
        miniPromptEl && (miniPromptEl.value = cfg.miniSystemPrompt || '');
        preferredFormatEl && (preferredFormatEl.value = cfg.preferredFormat || 'markdown');
        if (temperatureEl && temperatureValueEl) {
          const t = typeof cfg.temperature === 'number' ? cfg.temperature : 0.7;
          temperatureEl.value = String(t);
          temperatureValueEl.textContent = String(t);
        }
      } catch (e) {
        console.warn('Falha ao carregar config:', e);
      }
    }

    function openConfig() {
      if (!configOverlay) return;
      loadConfig();
      configOverlay.classList.add('open');
      configOverlay.setAttribute('aria-hidden', 'false');
    }

    function closeConfig() {
      if (!configOverlay) return;
      configOverlay.classList.remove('open');
      configOverlay.setAttribute('aria-hidden', 'true');
    }

    function saveConfig() {
      const cfg = {
        systemPrompt: systemPromptEl ? systemPromptEl.value.trim() : undefined,
        miniSystemPrompt: miniPromptEl ? miniPromptEl.value.trim() : undefined,
        preferredFormat: preferredFormatEl ? preferredFormatEl.value : undefined,
        temperature: temperatureEl ? Number(temperatureEl.value) : undefined,
      };
      localStorage.setItem('kenAiConfig', JSON.stringify(cfg));
      // Aplicar em tempo real
      if (cfg.systemPrompt) {
        // Atualiza promptTemplates.general.system se existir
        if (typeof promptTemplates === 'object' && promptTemplates.general) {
          promptTemplates.general.system = cfg.systemPrompt;
        }
      }
      // Mini prompt aplicado como contexto inicial salvo
      window.kenMiniSystemPrompt = cfg.miniSystemPrompt || '';
      window.kenAiPreferredFormat = cfg.preferredFormat || 'markdown';
      window.kenAiTemperature = typeof cfg.temperature === 'number' ? cfg.temperature : 0.7;
      closeConfig();
    }

    // Eventos UI config
    if (settingsBtn) settingsBtn.onclick = openConfig;
    if (configClose) configClose.onclick = closeConfig;
    if (configCancel) configCancel.onclick = closeConfig;
    if (configSave) configSave.onclick = saveConfig;
    if (configOverlay) configOverlay.addEventListener('click', (e) => {
      if (e.target === configOverlay) closeConfig();
    });
    if (temperatureEl && temperatureValueEl) temperatureEl.oninput = () => {
      temperatureValueEl.textContent = String(temperatureEl.value);
    };
    const voiceBtn = document.getElementById('kenAiVoiceBtn');
    const fileInput = document.getElementById('kenAiFileInput');
    const filePreview = document.getElementById('kenAiFilePreview');

    // Configurar event listeners
    setupEventListeners(panel, closeBtn, chat, input, sendBtn, voiceBtn, fileInput, filePreview);
  }

  // Função para configurar event listeners
  function setupEventListeners(
    panel,
    closeBtn,
    chat,
    input,
    sendBtn,
    voiceBtn,
    fileInput,
    filePreview
  ) {
    // Atualizar nome (imediato e a cada 5s)
    function updateStudentName() {
      const name = getUserNameFromSession();
      const nameEl = document.getElementById('kenAiStudentName');
      const welcomeEl = document.getElementById('kenAiWelcomeName');
      if (nameEl) {
        nameEl.textContent = name;
        nameEl.parentElement && nameEl.parentElement.setAttribute('title', name);
      }
      if (welcomeEl) welcomeEl.textContent = name;
    }
    updateStudentName();
    setInterval(updateStudentName, 5000);
    // Redimensionamento lateral (esquerda)
    (function setupResize() {
      const handle = document.getElementById('kenAiResizeHandle');
      if (!panel || !handle) return;

      const MIN_WIDTH = 520;
      const MAX_WIDTH = 720;

      let isDragging = false;
      let startX = 0;
      let startWidth = 0;

      function onMouseDown(e) {
        isDragging = true;
        startX = e.clientX;
        startWidth = panel.getBoundingClientRect().width;
        panel.classList.add('resizing');
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      }

      function onMouseMove(e) {
        if (!isDragging) return;
        const deltaX = startX - e.clientX; // arrastando para esquerda aumenta largura
        let newWidth = startWidth + deltaX;
        newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newWidth));
        panel.style.width = newWidth + 'px';
        panel.style.right = '0';
      }

      function onMouseUp() {
        if (!isDragging) return;
        isDragging = false;
        panel.classList.remove('resizing');
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        // Persistir largura
        try { localStorage.setItem('kenAiPanelWidth', panel.style.width || ''); } catch {}
      }

      handle.addEventListener('mousedown', onMouseDown);

      // Restaurar largura salva
      try {
        const savedWidth = localStorage.getItem('kenAiPanelWidth');
        if (savedWidth) {
          panel.style.width = savedWidth;
          panel.style.right = '0';
        }
      } catch {}
    })();
    // Funções principais
    function togglePanel() {
      const isOpen = panel.classList.contains('open');
      panel.classList.toggle('open');

      // Atualizar botão flutuante
      const floatingBtn = document.querySelector('.ken-ai-floating-btn');
      if (floatingBtn) {
        if (!isOpen) {
          floatingBtn.classList.add('panel-open');
        } else {
          floatingBtn.classList.remove('panel-open');
        }
      }

      if (!isOpen) {
        // Limpar estilo inline para garantir que o painel apareça
        panel.style.right = '';
        setTimeout(() => input.focus(), 400);
      } else {
        panel.style.right = '-500px';
      }
    }

    function closePanel() {
      panel.classList.remove('open');
      panel.style.right = '-500px';
    }

    // Função para obter API key
    function getNextApiKey() {
      return apiKeyManager.getNextAvailableKey();
    }

    // Função para melhorar prompts matemáticos
    function enhanceMathPrompt(message) {
      // Se a mensagem contém termos matemáticos, adicionar instruções específicas
      const mathKeywords = ['calcular', 'resolver', 'equação', 'fórmula', 'matemática', 'integral', 'derivada', 'limite', 'função', 'gráfico', 'x=', 'y=', '+', '-', '*', '/', '^', '√', '∫', '∑', 'sen', 'cos', 'tan', 'log'];

      const hasMath = mathKeywords.some(keyword =>
        message.toLowerCase().includes(keyword.toLowerCase())
      );

      if (hasMath) {
        return `${message}

IMPORTANTE: Se sua resposta contiver matemática, use SEMPRE a notação LaTeX correta:
- Para fórmulas inline: \\( sua_formula \\)
- Para fórmulas em bloco: \\[ sua_formula \\]
`;
      }

      return message;
    }



    // Adicionar mensagem
    function addMessage(content, isUser = false) {
      const messageDiv = document.createElement('div');
      messageDiv.className = `ken-ai-message ${isUser ? 'user' : 'ai'}`;

      const bubbleDiv = document.createElement('div');
      bubbleDiv.className = 'ken-ai-bubble';
      bubbleDiv.innerHTML = `<div class="markdown-content">${processMarkdown(content)}</div>`;

      messageDiv.appendChild(bubbleDiv);
      chat.appendChild(messageDiv);
      chat.scrollTop = chat.scrollHeight;

      // Renderizar matemática se KaTeX estiver disponível
      setTimeout(() => {
        if (window.katex && window.renderMathInElement && window.katexReady) {
          try {
            window.renderMathInElement(bubbleDiv, {
              delimiters: [
                { left: '$$', right: '$$', display: true },
                { left: '$', right: '$', display: false },
                { left: '\\[', right: '\\]', display: true },
                { left: '\\(', right: '\\)', display: false },
              ],
              throwOnError: false,
              errorColor: '#ff6b6b',
              strict: false,
            });
            console.log('Matemática renderizada com KaTeX');
          } catch (err) {
            console.warn('Erro ao renderizar matemática com KaTeX:', err);
          }
        } else {
          console.warn('KaTeX não disponível para renderização');
        }
      }, 200);

      chatHistory.push({
        role: isUser ? 'user' : 'model',
        parts: [{ text: content }],
      });

      // Salvar mensagem no novo sistema (apenas se não estiver carregando conversa)
      if (window.ChatManager && !window.ChatManager.isLoadingChat) {
        ChatManager.saveMessage(isUser ? 'user' : 'model', content);
      }

      // Atualizar painel de histórico em tempo real
      if (window.kenAI && window.kenAI.updateHistoryPanel) {
        setTimeout(() => window.kenAI.updateHistoryPanel(), 100);
      }
    }

    // Expor addMessage globalmente para uso do ChatManager
    window.addMessage = addMessage;

    // Mostrar loading
    function showLoading() {
      const loadingDiv = document.createElement('div');
      loadingDiv.className = 'ken-ai-message ai';
      loadingDiv.id = 'kenAiLoading';

      const bubbleDiv = document.createElement('div');
      bubbleDiv.className = 'ken-ai-bubble';
      bubbleDiv.innerHTML = `
            <div class="ken-ai-loading">
                <div class="ken-ai-spinner"></div>
                <span>Pensando...</span>
            </div>
        `;

      loadingDiv.appendChild(bubbleDiv);
      chat.appendChild(loadingDiv);
      chat.scrollTop = chat.scrollHeight;
    }

    // Remover loading
    function removeLoading() {
      const loading = document.getElementById('kenAiLoading');
      if (loading) loading.remove();
    }

    // Converter arquivo para base64
    function fileToBase64(file) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result.split(',')[1]);
        reader.readAsDataURL(file);
      });
    }


    // Modificar função de envio para Gemini
    async function sendToGemini(message, file = null) {
      const currentKey = getNextApiKey();

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${currentKey}`;

      // Melhorar prompt para matemática
      const enhancedMessage = enhanceMathPrompt(message);

      let parts = [{ text: enhancedMessage }];

      if (file) {
        const base64Data = await fileToBase64(file);
        parts.push({
          inline_data: {
            mime_type: file.type,
            data: base64Data,
          },
        });
      }

      // Adicionar prompt de sistema (customizável via Configurações)
      const userCfg = (() => { try { return JSON.parse(localStorage.getItem('kenAiConfig')||'{}'); } catch { return {}; } })();
      const defaultSystem = `🤖 SISTEMA KEN AI - ASSISTENTE DE ESTUDOS AVANÇADO:
Você é o KEN AI, um assistente de estudos inteligente.
Use resposta organizada (sempre)
Tenha cuidado com tags sensíveis.

📐 REGRAS MATEMÁTICAS OBRIGATÓRIAS (CRÍTICO):
• SEMPRE use LaTeX para QUALQUER matemática (inline: \( ... \), bloco: \[ ... \])
• NUNCA escreva matemática sem LaTeX
`;
      const systemPrompt = {
        role: 'user',
        parts: [{
          text: `${userCfg.systemPrompt || defaultSystem}\n\nAgora responda à pergunta do usuário: ${message}`
        }]
      };

      const requestBody = {
        contents: [systemPrompt, ...chatHistory, { role: 'user', parts: parts }],
        generationConfig: {
          temperature: (typeof window.kenAiTemperature === 'number' ? window.kenAiTemperature : (typeof userCfg.temperature === 'number' ? userCfg.temperature : 0.7)),
          maxOutputTokens: 2048,
          responseMimeType: 'text/plain',
        },
      };

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-client': 'rest/1.0',
          },
          body: JSON.stringify(requestBody),
        });

        // Log da resposta completa para diagnóstico
        const responseData = await response.json();

        // Verificar se há erro na resposta
        if (responseData.error) {
          console.error('Erro detalhado da API:', responseData.error);
          apiKeyManager.markKeyFailure(currentKey);
          throw new Error(responseData.error.message || 'Erro desconhecido na API');
        }

        // Extrair texto da resposta
        const responseText = responseData.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!responseText) {
          apiKeyManager.markKeyFailure(currentKey);
          throw new Error('Resposta da API não contém texto');
        }

        // Marcar chave como bem-sucedida
        apiKeyManager.markKeySuccess(currentKey);

        return responseText;
      } catch (error) {
        console.error('Erro completo na API:', error);

        // Marcar chave como falha
        apiKeyManager.markKeyFailure(currentKey);

        // Mensagens de erro mais amigáveis
        if (error.message.includes('429')) {
          return 'Desculpe, muitas solicitações foram feitas. Por favor, aguarde um momento e tente novamente.';
        }

        return `Desculpe, ocorreu um erro na comunicação com a IA: ${error.message}. Tente novamente mais tarde.`;
      }
    }

    // Adicionar função de log de erros
    function logApiError(error) {
      console.error('Erro de API:', error);

      // Opcional: Enviar log para um serviço de monitoramento
      // fetch('https://seu-servico-de-log.com/log', {
      //     method: 'POST',
      //     body: JSON.stringify({
      //         error: error.message,
      //         timestamp: new Date().toISOString()
      //     })
      // });
    }

    // Processar mensagem
    async function processMessage() {
      const message = input.value.trim();
      if (!message && uploadedFiles.length === 0) return;

      // Remover welcome e menu de comandos suavemente na primeira mensagem
      const welcomeMessage = document.querySelector('.ken-ai-welcome');
      const commandsMenu = document.querySelector('.ken-ai-commands-menu');

      if (welcomeMessage) {
        welcomeMessage.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        welcomeMessage.style.opacity = '0';
        welcomeMessage.style.transform = 'translateY(-20px)';
        setTimeout(() => {
          welcomeMessage.remove();
        }, 300);
      }

      if (commandsMenu) {
        commandsMenu.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        commandsMenu.style.opacity = '0';
        commandsMenu.style.transform = 'translateY(-20px)';
        setTimeout(() => {
          commandsMenu.remove();
        }, 400);
      }

      // Verificar se é comando search-pag (incluindo atalho /sp)
      const isSearchPageCommand =
        message.toLowerCase().startsWith('/search-pag') || message.toLowerCase().startsWith('/sp');
      let displayMessage = message;
      let finalMessage = message;

      if (isSearchPageCommand) {
        // Remover o comando da mensagem para exibição (tanto /search-pag quanto /sp)
        displayMessage = message.replace(/^\/(?:search-pag|sp)\s*/gi, '').trim();
        if (!displayMessage) {
          displayMessage = 'Buscando página...';
        }
      }

      const imageFiles = uploadedFiles.filter((file) => file.type.startsWith('image/'));

      // Adicionar informação sobre imagens à mensagem
      if (imageFiles.length > 0) {
        displayMessage += ` [${imageFiles.length} imagem(s) anexada(s)]`;
      }

      addMessage(displayMessage, true);
      input.value = '';

      // O novo sistema gerencia automaticamente as conversas
      // Não precisa mais de lógica manual de ID

      // Limpar preview de arquivos
      const previewContainer = document.getElementById('kenAiImagePreviewContainer');
      previewContainer.innerHTML = '';
      previewContainer.style.display = 'none';

      // Modificar loading para search-pag
      if (isSearchPageCommand) {
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'ken-ai-message ai';
        loadingDiv.id = 'kenAiLoading';

        const bubbleDiv = document.createElement('div');
        bubbleDiv.className = 'ken-ai-bubble';
        bubbleDiv.innerHTML = `
                <div class="ken-ai-loading">
                    <div class="ken-ai-spinner"></div>
                    <span>Buscando...</span>
                </div>
            `;

        loadingDiv.appendChild(bubbleDiv);
        chat.appendChild(loadingDiv);
        chat.scrollTop = chat.scrollHeight;
      } else {
        showLoading();
      }

      sendBtn.disabled = true;

      try {
        let filesToSend = null;
        let pageData = null;

        // Se for comando search-pag, capturar página
        if (isSearchPageCommand) {
          pageData = await capturePageData();
          if (pageData.screenshot) {
            filesToSend = pageData.screenshot;
            finalMessage = `${finalMessage
              .replace(/^\/(?:search-pag|sp)\s*/gi, '')
              .trim()}\n\nURL da página: ${pageData.url
              }\nPor favor, analise o screenshot desta página junto com minha pergunta.`;
          } else {
            finalMessage = `${finalMessage
              .replace(/^\/(?:search-pag|sp)\s*/gi, '')
              .trim()}\n\nURL da página: ${pageData.url
              }\nNão foi possível capturar screenshot, mas analise com base na URL.`;
          }

          // Atualizar mensagem de loading para "Analisando..."
          const loadingDiv = document.getElementById('kenAiLoading');
          if (loadingDiv) {
            const loadingSpan = loadingDiv.querySelector('.ken-ai-loading span');
            if (loadingSpan) loadingSpan.textContent = 'Analisando...';
          }
        }
        // Se houver imagens anexadas, preparar para envio
        else if (imageFiles.length > 0) {
          finalMessage = message || 'Analise esta(s) imagem(s) e explique o que vê.';
          filesToSend = imageFiles[0]; // Enviar apenas a primeira imagem por enquanto
        }

        // Aguardar um momento após "Concluído!"
        if (isSearchPageCommand) {
          const loadingDiv = document.getElementById('kenAiLoading');
          if (loadingDiv) {
            const loadingSpan = loadingDiv.querySelector('.ken-ai-loading span');
            if (loadingSpan) loadingSpan.textContent = 'Concluído!';

            // Aguardar 1 segundo antes de enviar para a IA
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }

        const response = await sendToGemini(finalMessage, filesToSend);

        // Remover loading
        if (isSearchPageCommand) {
          const loadingDiv = document.getElementById('kenAiLoading');
          if (loadingDiv) loadingDiv.remove();
        } else {
          removeLoading();
        }

        addMessage(response);

        // Limpar arquivos após envio
        uploadedFiles = uploadedFiles.filter((file) => !imageFiles.includes(file));

        // Atualizar preview se ainda houver arquivos
        updateImagePreviews();
      } catch (error) {
        // Remover loading em caso de erro
        if (isSearchPageCommand) {
          const loadingDiv = document.getElementById('kenAiLoading');
          if (loadingDiv) loadingDiv.remove();
        } else {
          removeLoading();
        }

        addMessage('Erro ao processar. Tente novamente.');
      }

      sendBtn.disabled = false;
      input.focus();
    }

    // Inicializar reconhecimento de voz
    function initVoice() {
      if ('webkitSpeechRecognition' in window) {
        recognition = new webkitSpeechRecognition();
        recognition.continuous = false;
        recognition.lang = 'pt-BR';

        recognition.onstart = () => {
          isListening = true;
          voiceBtn.classList.add('listening');
        };

        recognition.onresult = (event) => {
          input.value = event.results[0][0].transcript;
        };

        recognition.onend = () => {
          isListening = false;
          voiceBtn.classList.remove('listening');
        };
      }
    }

    // Event Listeners
    closeBtn.addEventListener('click', closePanel);
    sendBtn.addEventListener('click', processMessage);

    voiceBtn.addEventListener('click', () => {
      if (recognition) {
        isListening ? recognition.stop() : recognition.start();
      }
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        processMessage();
      }
    });

    // Auto-resize textarea
    function autoResize(textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 100) + 'px';
    }

    input.addEventListener('input', function () {
      autoResize(this);
    });

    // Upload de arquivo
    fileInput.addEventListener('change', (e) => {
      const newFiles = Array.from(e.target.files);
      const imageFiles = newFiles.filter((file) => file.type.startsWith('image/'));
      const currentImageCount = uploadedFiles.filter((file) =>
        file.type.startsWith('image/')
      ).length;

      // Verificar se adicionar novas imagens ultrapassaria o limite
      if (currentImageCount + imageFiles.length > 3) {
        const previewContainer = document.getElementById('kenAiImagePreviewContainer');
        const limitMessage = document.createElement('div');
        limitMessage.className = 'ken-ai-image-limit-message';
        limitMessage.textContent = '🚫 Limite máximo de 3 imagens atingido';

        // Manter as imagens existentes
        const imageWrapper = document.createElement('div');
        imageWrapper.className = 'ken-ai-image-preview-wrapper';

        // Mostrar as 3 primeiras imagens existentes
        const existingImageFiles = uploadedFiles
          .filter((file) => file.type.startsWith('image/'))
          .slice(0, 3);

        existingImageFiles.forEach((file) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const previewDiv = document.createElement('div');
            previewDiv.className = 'ken-ai-image-preview';

            const img = document.createElement('img');
            img.src = e.target.result;

            const removeBtn = document.createElement('button');
            removeBtn.className = 'ken-ai-image-preview-remove';
            removeBtn.innerHTML = '&times;';
            removeBtn.onclick = () => {
              uploadedFiles = uploadedFiles.filter((f) => f !== file);
              updateImagePreviews();
            };

            previewDiv.appendChild(img);
            previewDiv.appendChild(removeBtn);
            imageWrapper.appendChild(previewDiv);
          };
          reader.readAsDataURL(file);
        });

        previewContainer.innerHTML = '';
        previewContainer.appendChild(limitMessage);
        previewContainer.appendChild(imageWrapper);
        previewContainer.style.display = 'flex';
        return;
      }

      uploadedFiles = [...uploadedFiles, ...newFiles];
      updateImagePreviews();
    });

    // Atalhos
    document.addEventListener('keydown', (e) => {
      if (e.altKey && e.key === 'k') {
        e.preventDefault();
        togglePanel();
      }

      if (e.key === 'Escape' && panel.classList.contains('open')) {
        closePanel();
      }
    });

    // Detectar seleção de texto na página
    document.addEventListener('mouseup', (event) => {
      // Verificar se o clique não foi em um link
      if (event.target.tagName.toLowerCase() === 'a') return;

      // Obter seleção de texto
      const selection = window.getSelection();
      let selectedText = '';

      // Verificar se há uma seleção
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const container = range.commonAncestorContainer;

        // Extrair texto sem tags HTML
        const tempDiv = document.createElement('div');
        tempDiv.appendChild(range.cloneContents());
        selectedText = tempDiv.textContent.trim();
      }

      // Verificar condições de texto
      if (selectedText && selectedText.length > 0 && selectedText.length < 500) {
        // Remover múltiplos espaços e quebras de linha
        selectedText = selectedText.replace(/\s+/g, ' ');

        // Mostrar tooltip com opções
        showSelectionTooltip(selectedText);
      }
    });

    // Função para mostrar tooltip de seleção
    function showSelectionTooltip(text) {
      console.log('Iniciando showSelectionTooltip com texto:', text);

      // Remove tooltip anterior se existir
      const existingTooltip = document.getElementById('kenAiTooltip');
      if (existingTooltip) existingTooltip.remove();

      // Verificar se o painel existe
      const panel = document.getElementById('kenAiPanel');
      const input = document.getElementById('kenAiInput');

      if (!panel || !input) {
        console.error('Painel ou input não encontrados');
        return;
      }

      const tooltip = document.createElement('div');
      tooltip.id = 'kenAiTooltip';
      tooltip.innerHTML = `
        <div style="
            position: fixed;
            display: flex;
            gap: 8px;
            z-index: 1000000;
            font-family: 'Inter', sans-serif;
        ">
            <!-- Botão principal Explicar -->
            <div style="
                background: linear-gradient(135deg, #6366f1, #8b5cf6);
                color: white;
                padding: 8px 12px;
                border-radius: 20px;
                font-size: 12px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                cursor: pointer;
                font-weight: 500;
                border: 1px solid rgba(255,255,255,0.2);
                backdrop-filter: blur(10px);
                transition: all 0.2s ease;
            "
            onmouseover="this.style.transform='scale(1.05)'"
            onmouseout="this.style.transform='scale(1)'"
            onclick="
                console.log('Tooltip Explicar clicado');
                const panel = document.getElementById('kenAiPanel');
                const input = document.getElementById('kenAiInput');
                if (panel && input) {
                    panel.classList.add('open');
                    panel.style.right = '0';
                    input.value = 'Explique: ${text.replace(/'/g, "\\'")}';
                    input.focus();
                    document.getElementById('kenAiTooltip').remove();
                }
            ">
                <i class="fas fa-graduation-cap"></i> Explicar
            </div>

            <!-- Mini KEN AI Chat -->
            <div style="
                background: linear-gradient(135deg, #6366f1, #8b5cf6);
                color: white;
                padding: 8px 12px;
                border-radius: 20px;
                font-size: 12px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                cursor: pointer;
                font-weight: 500;
                border: 1px solid rgba(255,255,255,0.2);
                backdrop-filter: blur(10px);
                transition: all 0.2s ease;
            "
            onmouseover="this.style.transform='scale(1.05)'"
            onmouseout="this.style.transform='scale(1)'"
            onclick="openMiniKenWithContext('${text.replace(/'/g, "\\'")}')">
                <i class="fas fa-robot"></i> Mini KEN
            </div>
        </div>
    `;

      // Posicionar tooltip
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const tooltipDiv = tooltip.firstElementChild;

        tooltipDiv.style.left = rect.left + rect.width / 2 - 120 + 'px';
        tooltipDiv.style.top = rect.top - 50 + 'px';
      }

      document.body.appendChild(tooltip);
      console.log('Tooltip com menu AI adicionado ao corpo do documento');

      // Adicionar evento para fechar menu ao clicar fora
      const closeMenuOnClickOutside = (event) => {
        const dropdown = document.getElementById('kenAiMenuDropdown');
        const menuButton = event.target.closest('[onclick*="kenAiMenuDropdown"]');

        if (dropdown && !dropdown.contains(event.target) && !menuButton) {
          dropdown.style.display = 'none';
        }
      };

      document.addEventListener('click', closeMenuOnClickOutside);

      // Remove tooltip após 8 segundos (aumentado para dar tempo de usar o menu)
      const removeTooltip = () => {
        if (tooltip.parentNode) {
          tooltip.remove();
          document.removeEventListener('click', closeMenuOnClickOutside);
          console.log('Tooltip removido');
        }
      };

      setTimeout(removeTooltip, 8000);

      // Também remover se clicar fora do tooltip
      setTimeout(() => {
        document.addEventListener(
          'click',
          (event) => {
            if (!tooltip.contains(event.target)) {
              removeTooltip();
            }
          },
          { once: true }
        );
      }, 100);
    }

    // Função para abrir Mini KEN Chat (global)
    window.openMiniKenChat = function (selectedText) {
      console.log('Abrindo Mini KEN Chat com texto:', selectedText);

      // Debug: Verificar seleção atual
      const selection = window.getSelection();
      console.log('Seleção atual:', selection);
      console.log('Ranges na seleção:', selection.rangeCount);

      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        console.log('Range selecionado:', range);
        console.log('Conteúdo do range:', range.toString());

        // Verificar se há imagens na seleção
        const tempDiv = document.createElement('div');
        tempDiv.appendChild(range.cloneContents());
        const images = tempDiv.querySelectorAll('img');
        console.log('Imagens na seleção (debug):', images.length);
        images.forEach((img, i) => {
          console.log(`Imagem ${i + 1}:`, img.src, img.alt);
        });
      }

      // Remover tooltip de seleção
      const tooltip = document.getElementById('kenAiTooltip');
      if (tooltip) tooltip.remove();

      // Remover mini chat anterior se existir
      const existingMiniChat = document.getElementById('kenMiniChat');
      if (existingMiniChat) existingMiniChat.remove();

      // Criar mini chat
      createMiniKenChat(selectedText);
    };

    // Função para criar Mini KEN Chat
    function createMiniKenChat(selectedText) {
      // Obter posição da seleção e capturar imagens
      const selection = window.getSelection();
      let rect = { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 0, height: 0 };
      let selectedImages = [];

      // Usar contexto armazenado se disponível
      const savedContext = window.miniKenContext || null;

      if (selection.rangeCount > 0) {
        rect = selection.getRangeAt(0).getBoundingClientRect();

        // Capturar imagens na seleção
        const range = selection.getRangeAt(0);

        // DEBUG AVANÇADO - Mostrar detalhes da seleção
        console.log('=== DETECÇÃO DE IMAGENS AVANÇADA ===');
        console.log('Range:', range);
        console.log('Texto selecionado:', selectedText);
        console.log('Ancestor container:', range.commonAncestorContainer);

        // Método 1: Clonar conteúdo da seleção (melhorado)
        try {
          const tempDiv = document.createElement('div');
          tempDiv.appendChild(range.cloneContents());

          // Debug do conteúdo clonado
          console.log('Conteúdo HTML clonado:', tempDiv.innerHTML);

          // Buscar imagens no conteúdo clonado
          const clonedImages = tempDiv.querySelectorAll('img');
          console.log('Imagens encontradas no conteúdo clonado:', clonedImages.length);

          clonedImages.forEach(img => {
            console.log('Imagem clonada encontrada:', img.src, img.alt);
            if (img.src) {
              selectedImages.push({
                src: img.src,
                alt: img.alt || 'Imagem selecionada',
                width: img.width || 'auto',
                height: img.height || 'auto'
              });
            }
          });
        } catch (e) {
          console.error('Erro ao clonar conteúdo da seleção:', e);
        }

        // Método 2: Verificar elementos intersectando com a seleção (melhorado)
        try {
          const selectionRect = range.getBoundingClientRect();
          console.log('Retângulo da seleção:', selectionRect);

          // Buscar todas as imagens visíveis na página
          const allImages = Array.from(document.querySelectorAll('img')).filter(img => {
            const imgRect = img.getBoundingClientRect();
            const isVisible = imgRect.width > 0 && imgRect.height > 0 && img.src;
            if (isVisible) {
              console.log('Imagem visível encontrada:', img.src, 'Dimensões:', imgRect);
            }
            return isVisible;
          });

          console.log('Total de imagens visíveis na página:', allImages.length);

          allImages.forEach(img => {
            const imgRect = img.getBoundingClientRect();

            // Verificar se a imagem está contida ou intersecta com a seleção
            const intersects = !(imgRect.right < selectionRect.left ||
              imgRect.left > selectionRect.right ||
              imgRect.bottom < selectionRect.top ||
              imgRect.top > selectionRect.bottom);

            // Verificar se a imagem está próxima da seleção
            const distance = Math.sqrt(
              Math.pow((imgRect.left + imgRect.width / 2) - (selectionRect.left + selectionRect.width / 2), 2) +
              Math.pow((imgRect.top + imgRect.height / 2) - (selectionRect.top + selectionRect.height / 2), 2)
            );

            console.log(`Imagem ${img.src} - Intersecta: ${intersects}, Distância: ${distance}`);

            if ((intersects || distance < 150) && img.src && selectedImages.length < 3) {
              console.log('Imagem intersectando/próxima encontrada:', img.src, img.alt);
              // Evitar duplicatas
              const alreadyAdded = selectedImages.some(existing => existing.src === img.src);
              if (!alreadyAdded) {
                selectedImages.push({
                  src: img.src,
                  alt: img.alt || 'Imagem na seleção',
                  width: img.width || 'auto',
                  height: img.height || 'auto'
                });
                console.log(`Imagem ${selectedImages.length}/3 adicionada`);
              }
            } else if (selectedImages.length >= 3) {
              console.log('Limite de 3 imagens atingido na captura inicial');
            }
          });
        } catch (e) {
          console.error('Erro ao verificar intersecção de imagens:', e);
        }

        // Método 3: Verificar se a seleção contém elementos img diretamente (melhorado)
        try {
          // Usar TreeWalker para encontrar todas as imagens no documento
          const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_ELEMENT,
            {
              acceptNode: function (node) {
                if (node.tagName === 'IMG') {
                  return NodeFilter.FILTER_ACCEPT;
                }
                return NodeFilter.FILTER_SKIP;
              }
            }
          );

          let node; 
          while (node = walker.nextNode()) {
            if (selectedImages.length >= 3) {
              console.log('Limite de 3 imagens atingido no TreeWalker');
              break;
            }
            if (range.intersectsNode(node)) {
              console.log('Imagem encontrada via TreeWalker:', node.src, node.alt);
              const alreadyAdded = selectedImages.some(existing => existing.src === node.src);
              if (!alreadyAdded && node.src) {
                selectedImages.push({
                  src: node.src,
                  alt: node.alt || 'Imagem via TreeWalker',
                  width: node.width || 'auto',
                  height: node.height || 'auto'
                });
                console.log(`Imagem ${selectedImages.length}/3 adicionada via TreeWalker`);
              }
            }
          }
        } catch (e) {
          console.error('Erro no TreeWalker:', e);
        }

        console.log('Total de imagens capturadas:', selectedImages.length, selectedImages);
      }

      // Calcular posição do mini chat (próximo à seleção, mas visível)
      let chatLeft = rect.left + rect.width / 2 - 200; // Centralizar horizontalmente
      let chatTop = rect.bottom + 10; // Abaixo da seleção

      // Ajustar se sair da tela
      if (chatLeft < 10) chatLeft = 10;
      if (chatLeft + 400 > window.innerWidth - 10) chatLeft = window.innerWidth - 410;
      if (chatTop + 500 > window.innerHeight - 10) chatTop = rect.top - 510; // Acima se não couber embaixo
      if (chatTop < 10) chatTop = 10;

      const miniChat = document.createElement('div');
      miniChat.id = 'kenMiniChat';

      try {
        // Usar DOMParser para contornar restrições de TrustedHTML
        const htmlContent = `
          <!-- Mini Chat Container (Móvel) -->
          <div id="miniChatContainer" style="
            position: fixed;
            left: ${chatLeft}px;
            top: ${chatTop}px;
            width: 400px;
            height: 500px;
            background: linear-gradient(180deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%);
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
            z-index: 1000002;
            font-family: 'Inter', sans-serif;
            border: 1px solid rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(20px);
            display: flex;
            flex-direction: column;
            animation: miniChatSlideIn 0.3s ease-out;
          ">
            <!-- Header do Mini Chat (Draggable) -->
            <div id="miniChatHeader" style="
              padding: 15px 20px;
              border-bottom: 1px solid rgba(255, 255, 255, 0.15);
              display: flex;
              align-items: center;
              justify-content: space-between;
              background: rgba(255, 255, 255, 0.1);
              border-radius: 20px 20px 0 0;
              cursor: move;
              user-select: none;
            ">
              <div style="display: flex; align-items: center; gap: 10px;">
                <div style="
                  width: 28px;
                  height: 28px;
                  background: linear-gradient(45deg, #ff6b6b, #ffd93d);
                  border-radius: 8px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-weight: bold;
                  color: white;
                  font-size: 12px;
                ">KEN</div>
                <div>
                  <div style="color: white; font-size: 14px; font-weight: 600;">Mini KEN AI</div>
                  <div style="color: rgba(255, 255, 255, 0.7); font-size: 10px;">
                    <i class="fas fa-arrows-alt" style="margin-right: 4px;"></i>Arraste para mover
                  </div>
                </div>
              </div>
              <div style="display: flex; gap: 8px;">
                <button id="clearMiniChatHistory" style="
                  width: 28px;
                  height: 28px;
                  border: none;
                  border-radius: 8px;
                  background: rgba(255, 255, 255, 0.1);
                  color: white;
                  cursor: pointer;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  transition: all 0.2s ease;
                " onmouseover="this.style.background='rgba(255, 255, 255, 0.2)'" onmouseout="this.style.background='rgba(255, 255, 255, 0.1)'" title="Limpar histórico">
                  <i class="fas fa-trash-alt"></i>
                </button>
                <button onclick="closeMiniKenChat()" style="
                  width: 28px;
                  height: 28px;
                  border: none;
                  border-radius: 8px;
                  background: rgba(255, 255, 255, 0.1);
                  color: white;
                  cursor: pointer;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  transition: all 0.2s ease;
                " onmouseover="this.style.background='rgba(255, 255, 255, 0.2)'" onmouseout="this.style.background='rgba(255, 255, 255, 0.1)'">
                  <i class="fas fa-times"></i>
                </button>
              </div>
            </div>
        `;

        // Usar parser para converter HTML para DOM
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');
        const container = doc.body.firstChild;

        if (container) {
          miniChat.appendChild(container);

          // Continuar criando os elementos restantes manualmente
          const messagesContainer = document.createElement('div');
          messagesContainer.id = 'miniChatMessages';
          messagesContainer.style.cssText = `
            flex: 1;
            padding: 15px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 10px;
            height: 380px;
            font-size: 13px;
            line-height: 1.4;
          `;

          // Mensagem inicial com texto selecionado
          const initialMessage = document.createElement('div');
          initialMessage.style.cssText = `
            background: rgba(255, 255, 255, 0.1);
            padding: 10px 12px;
            border-radius: 12px;
            border-left: 3px solid #ffd93d;
            margin-bottom: 10px;
          `;

          // Título do conteúdo selecionado
          const titleDiv = document.createElement('div');
          titleDiv.style.cssText = `
            color: #ffd93d; 
            font-size: 10px; 
            font-weight: 600; 
            margin-bottom: 5px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          `;
          titleDiv.innerHTML = '<span><i class="fas fa-quote-left"></i> CONTEÚDO SELECIONADO</span>';

          // Adicionar badge de contexto
          const contextBadge = document.createElement('span');
          contextBadge.style.cssText = `
            background: rgba(255, 217, 61, 0.2);
            color: #ffd93d;
            padding: 2px 6px;
            border-radius: 10px;
            font-size: 8px;
            font-weight: bold;
          `;
          contextBadge.textContent = 'CONTEXTO';
          titleDiv.appendChild(contextBadge);

          // Conteúdo selecionado
          const contentDiv = document.createElement('div');
          contentDiv.style.cssText = `
            color: white; 
            font-size: 11px; 
            line-height: 1.4;
            max-height: 150px;
            overflow-y: auto;
            padding-right: 5px;
            scrollbar-width: thin;
            scrollbar-color: rgba(255, 255, 255, 0.3) transparent;
          `;
          contentDiv.textContent = selectedText;

          // Adicionar elementos à mensagem inicial
          initialMessage.appendChild(titleDiv);
          initialMessage.appendChild(contentDiv);

          // Adicionar imagens capturadas se houver
          if (selectedImages.length > 0) {
            const imagesContainer = document.createElement('div');
            imagesContainer.style.marginTop = '8px';

            const imagesTitle = document.createElement('div');
            imagesTitle.style.cssText = `
              color: #ffd93d; 
              font-size: 9px; 
              font-weight: 600; 
              margin-bottom: 5px;
            `;
            imagesTitle.innerHTML = `<i class="fas fa-image"></i> IMAGENS CAPTURADAS (${selectedImages.length})`;

            const imagesGrid = document.createElement('div');
            imagesGrid.style.cssText = `
              display: flex; 
              gap: 5px; 
              flex-wrap: wrap;
            `;

            // Adicionar cada imagem
            selectedImages.forEach((img, index) => {
              const imgContainer = document.createElement('div');
              imgContainer.style.position = 'relative';

              const imgElement = document.createElement('img');
              imgElement.src = img.src;
              imgElement.alt = img.alt;
              imgElement.style.cssText = `
                max-width: 60px;
                max-height: 60px;
                border-radius: 4px;
                object-fit: cover;
                border: 1px solid rgba(255, 255, 255, 0.2);
                cursor: pointer;
                transition: transform 0.2s ease;
              `;
              imgElement.onclick = function () {
                window.openImagePreview(img.src.replace(/'/g, "\\'"), img.alt.replace(/'/g, "\\'"));
              };
              imgElement.onmouseover = function () {
                this.style.transform = 'scale(1.1)';
              };
              imgElement.onmouseout = function () {
                this.style.transform = 'scale(1)';
              };

              const badge = document.createElement('div');
              badge.style.cssText = `
                position: absolute;
                bottom: -2px;
                right: -2px;
                background: #ffd93d;
                color: #333;
                border-radius: 50%;
                width: 16px;
                height: 16px;
                font-size: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
              `;
              badge.textContent = index + 1;

              imgContainer.appendChild(imgElement);
              imgContainer.appendChild(badge);
              imagesGrid.appendChild(imgContainer);
            });

            imagesContainer.appendChild(imagesTitle);
            imagesContainer.appendChild(imagesGrid);
            initialMessage.appendChild(imagesContainer);
          }

          // Adicionar mensagem inicial ao container
          messagesContainer.appendChild(initialMessage);

          // Botões de ação rápida
          const quickActions = document.createElement('div');
          quickActions.id = 'miniChatQuickActions';
          quickActions.style.cssText = `
          display: flex !important;
           gap: 4px !important;
            flex-wrap: wrap;
            margin-bottom: 15px;
            transition: all 0.3s ease;
          `;

          // Função para criar botão de ação rápida
          function createQuickButton(text, icon, action) {
            const btn = document.createElement('button');
            btn.style.cssText = `
              background: rgba(255, 255, 255, 0.1);
              border: 1px solid rgba(255, 255, 255, 0.2);
              border-radius: 15px;
              padding: 6px 10px;
              color: white;
              font-size: 10px;
              cursor: pointer;
              transition: all 0.2s ease;
              font-family: 'Inter', sans-serif;
            `;
            btn.innerHTML = `<i class="fas fa-${icon}"></i> ${text}`;
            btn.onmouseover = function () {
              this.style.background = 'rgba(255, 255, 255, 0.2)';
            };
            btn.onmouseout = function () {
              this.style.background = 'rgba(255, 255, 255, 0.1)';
            };
            btn.onclick = function () {
              window.quickMiniAction(action);
            };
            return btn;
          }

          // Adicionar botões de ação rápida
          quickActions.appendChild(createQuickButton('Explicar', 'lightbulb', 'Explique:'));
          quickActions.appendChild(createQuickButton('Resumir', 'compress-alt', 'Resuma:'));
          quickActions.appendChild(createQuickButton('Traduzir', 'language', 'Traduza:'));
          quickActions.appendChild(createQuickButton('Quiz', 'question-circle', 'Crie um quiz sobre:'));


          // Adicionar botões de ação rápida ao container
          messagesContainer.appendChild(quickActions);

          // Criar área para preview de imagens centralizada (área amarela)
          const centralImagePreview = document.createElement('div');
          centralImagePreview.id = 'miniChatFilePreview';
          centralImagePreview.style.cssText = `
            display: none !important;
            position: fixed;
            bottom: 130px;
            left: 50%;
            transform: translateX(-50%);
            padding: 10px;
            margin: 15px auto;
            background: rgba(0, 0, 0, 0.2);
            border-radius: 15px;
            max-height: 200px;
            width: 90%;
            overflow-y: auto;
            overflow-x: hidden;
            text-align: center;
            border: 1px dashed rgba(255, 217, 61, 0.3);
          `;

          // Adicionar área de preview centralizada ao container de mensagens
          messagesContainer.appendChild(centralImagePreview);

          // Adicionar mensagem inicial ao container
          messagesContainer.appendChild(initialMessage);

          // Adicionar área de mensagens ao container principal
          container.appendChild(messagesContainer);

          // Carregar histórico de conversas anteriores
          loadMiniChatHistory(messagesContainer);

          // Adicionar mensagem de boas-vindas se não houver histórico
          if (miniChatHistory.length === 0) {
            // Adicionar resposta da IA com mensagem de boas-vindas
            const welcomeMessage = document.createElement('div');
            welcomeMessage.className = 'mini-chat-welcome-message';
            welcomeMessage.innerHTML = `
              <div style="
                display: flex;
                justify-content: flex-start;
                margin-bottom: 10px;
                animation: slideInLeft 0.3s ease-out;">
                <div style="
                  background: rgba(0, 0, 0, 0.2);
                  color: white;
                  padding: 8px 12px;
                  border-radius: 12px;
                  max-width: 80%;
                  font-size: 11px;
                  line-height: 1.4;
                  border-bottom-left-radius: 4px;
                ">
                  Olá! Sou o Ken Mini e posso ajudar com o conteúdo selecionado. Tenho memória de conversas anteriores, então você pode fazer perguntas relacionadas às minhas respostas anteriores.
                </div>
              </div>
            `;
            messagesContainer.appendChild(welcomeMessage);
          }

          // Criar área de input
          const inputArea = document.createElement('div');
          inputArea.id = 'miniChatInputArea';
          inputArea.style.cssText = `
            padding: 15px;
            border-top: 1px solid rgba(255, 255, 255, 0.15);
            background: rgba(255, 255, 255, 0.05);
            border-radius: 0 0 20px 20px;
            position: relative;
          `;

          // Indicação de drag and drop
          const dragDropHint = document.createElement('div');
          dragDropHint.style.cssText = `
            text-align: center;
            color: rgba(255, 255, 255, 0.5);
            font-size: 10px;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 5px;
          `;
          dragDropHint.innerHTML = '<i class="fas fa-image"></i><span>Arraste imagens aqui ou digite sua pergunta</span>';
          inputArea.appendChild(dragDropHint);

          // Container de input e botão
          const inputContainer = document.createElement('div');
          inputContainer.style.cssText = 'display: flex; gap: 8px; align-items: flex-end;';

          // Wrapper do input
          const inputWrapper = document.createElement('div');
          inputWrapper.style.cssText = 'flex: 1; position: relative;';

          // Textarea (sem área de preview aqui, pois já foi adicionada acima)
          const textarea = document.createElement('textarea');
          textarea.id = 'miniChatInput';
          textarea.placeholder = 'Pergunte sobre o conteúdo...';
          textarea.style.cssText = `
            width: calc(100% - 16px);
            height: 35px;
            min-height: 35px;
            max-height: 80px;
            padding: 8px 12px;
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 18px;
            background: rgba(255, 255, 255, 0.1);
            color: white;
            font-size: 12px;
            font-family: 'Inter', sans-serif;
            resize: none;
            outline: none;
            transition: all 0.2s ease;
            box-sizing: border-box;

          `;
          textarea.oninput = function () {
            this.style.height = '';
            this.style.height = Math.min(80, this.scrollHeight) + 'px';
          };
          textarea.onfocus = function () {
            this.style.borderColor = 'rgba(255, 255, 255, 0.4)';
          };
          textarea.onblur = function () {
            this.style.borderColor = 'rgba(255, 255, 255, 0.2)';
          };

          // Montar componentes (apenas textarea, sem preview)
          inputWrapper.appendChild(textarea);

          // Criar botão de enviar
          const sendBtn = document.createElement('button');
          sendBtn.style.cssText = `
            width: 35px;
            height: 35px;
            border: none;
            border-radius: 50%;
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
            font-size: 14px;
            flex-shrink: 0;
          `;
          sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
          sendBtn.onmouseover = function () {
            this.style.transform = 'scale(1.1)';
            this.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
          };
          sendBtn.onmouseout = function () {
            this.style.transform = 'scale(1)';
            this.style.boxShadow = 'none';
          };
          sendBtn.onclick = function (e) {
            e.preventDefault();
            e.stopPropagation();
            window.sendMiniChatMessage();
          };

          inputContainer.appendChild(inputWrapper);
          inputContainer.appendChild(sendBtn);
          inputArea.appendChild(inputContainer);

          // Adicionar área de input ao container principal
          container.appendChild(inputArea);

          // Adicionar ao DOM
          document.body.appendChild(miniChat);

          // Configurar eventos
          const input = document.getElementById('miniChatInput');
          if (input) {
            // Focar no input
            setTimeout(() => input.focus(), 300);

            // Configurar tecla Enter para enviar
            input.addEventListener('keydown', (e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                window.sendMiniChatMessage();
              }
            });

            // Adicionar texto selecionado como primeira mensagem se houver
            if (selectedText.trim()) {
              input.value = 'Explique: ';
              setTimeout(() => {
                input.setSelectionRange(input.value.length, input.value.length);
                // Removido o envio automático
                // window.sendMiniChatMessage();
              }, 500);
            }
          }

          // Tornar arrastável
          makeMiniChatDraggable();

          // Configurar botão de limpar histórico
          setupClearHistoryButton();


          // Configurar drag and drop de imagens
          setupImageDragDrop();

          // Armazenar imagens selecionadas globalmente (limitado a 3)
          const originalCount = selectedImages.length;
          window.miniChatSelectedImages = selectedImages.slice(0, 3);

          // Debug
          console.log('Imagens armazenadas globalmente:', window.miniChatSelectedImages);
          if (originalCount > 3) {
            console.log(`${originalCount - 3} imagens ignoradas (limite de 3 no Mini Chat)`);
          }

          // Atualizar display de imagens se houver
          if (window.miniChatSelectedImages.length > 0) {
            setTimeout(() => {
              updateMiniChatImages();
              updateCaptureButton();
            }, 500);
          }
        } else {
          console.error('Falha ao criar elementos do mini chat usando DOMParser');
          throw new Error('Falha no parser');
        }
      } catch (error) {
        console.error('Erro ao criar mini chat com DOMParser:', error);

        // Fallback para método tradicional (menos elementos)
        const fallbackHTML = `
          <div id="miniChatContainer" style="position:fixed; left:${chatLeft}px; top:${chatTop}px; width:400px; height:500px; background:#6366f1; border-radius:20px; z-index:1000002;">
            <div id="miniChatHeader" style="padding:15px; border-bottom:1px solid rgba(255,255,255,0.2);">
              <div style="color:white; font-size:14px;">Mini KEN AI</div>
              <button onclick="closeMiniKenChat()" style="position:absolute; right:15px; top:15px; background:none; border:none; color:white; cursor:pointer;">×</button>
            </div>
            <div id="miniChatMessages" style="height:380px; overflow-y:auto; padding:15px;">
              <div style="color:white; padding:10px; background:rgba(255,255,255,0.1); border-radius:10px; margin-bottom:10px;">
                ${selectedText}
              </div>
            </div>
            <div id="miniChatInputArea" style="padding:15px; border-top:1px solid rgba(255,255,255,0.2);">
              <div id="miniChatFilePreview" style="display:none; position:fixed; bottom:130px; left:50%; transform:translateX(-50%); margin-bottom:8px; background:rgba(0,0,0,0.2); border-radius:10px; padding:8px; max-height:200px; overflow-y:auto;"></div>
              <div style="display:flex; gap:8px; align-items:flex-end;">
                <textarea id="miniChatInput" placeholder="Pergunte sobre o conteúdo..." style="flex:1; padding:10px; border-radius:10px; border:none; resize:none; height:35px;"></textarea>
                <button onclick="window.sendMiniChatMessage()" style="width:35px; height:35px; border:none; border-radius:50%; background:linear-gradient(135deg, #667eea, #764ba2); color:white; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:14px;">
                  <i class="fas fa-paper-plane"></i>
                </button>
              </div>
            </div>
          </div>
        `;

        miniChat.innerHTML = fallbackHTML;
        document.body.appendChild(miniChat);

        // Carregar histórico mesmo no modo fallback
        const messagesContainer = document.getElementById('miniChatMessages');
        if (messagesContainer) {
          loadMiniChatHistory(messagesContainer);

          // Adicionar mensagem de boas-vindas se não houver histórico
          if (miniChatHistory.length === 0) {
            const welcomeMessage = document.createElement('div');
            welcomeMessage.innerHTML = `
              <div style="color:white; padding:10px; background:rgba(0,0,0,0.2); border-radius:10px; margin-bottom:10px;">
                Olá! Sou o Ken Mini e posso ajudar com o conteúdo selecionado. Tenho memória de conversas anteriores.
              </div>
            `;
            messagesContainer.appendChild(welcomeMessage);
          }
        }
      }
    }

    // Função para configurar o botão de limpar histórico
    function setupClearHistoryButton() {
      const clearBtn = document.getElementById('clearMiniChatHistory');
      if (!clearBtn) return;

      clearBtn.onclick = function (e) {
        e.preventDefault();
        e.stopPropagation();

        if (confirm('Deseja limpar o histórico de conversas do Ken Mini?')) {
          // Limpar histórico
          miniChatHistory = [];
          saveMiniChatHistory();

          // Limpar mensagens na interface
          const messagesContainer = document.getElementById('miniChatMessages');
          if (messagesContainer) {
            // Manter apenas a mensagem inicial (conteúdo selecionado)
            const initialMessage = messagesContainer.querySelector('[style*="border-left: 3px solid #ffd93d"]');
            messagesContainer.innerHTML = '';
            if (initialMessage) {
              messagesContainer.appendChild(initialMessage);
            }
          }

          // Mostrar feedback
          showFeedback('Histórico do Ken Mini limpo com sucesso', 'success');
        }
      };
    }

    // Função para configurar o botão de análise de seleção
    function setupAnalyzeSelectionButton() {
      // Verificar se o elemento miniChatHeader existe
      const miniChatHeader = document.getElementById('miniChatHeader');
      if (!miniChatHeader) return;

      // Verificar se o botão já existe
      if (document.getElementById('analyzeSelectionBtn')) return;

      // Criar botão de análise
      const analyzeBtn = document.createElement('button');
      analyzeBtn.id = 'analyzeSelectionBtn';
      analyzeBtn.innerHTML = '<i class="fas fa-magic"></i>';
      analyzeBtn.title = 'Analisar conteúdo selecionado';
      analyzeBtn.style.cssText = `
        position: absolute;
        right: 50px;
        top: 15px;
        background: none;
        border: none;
        color: white;
        font-size: 16px;
        cursor: pointer;
        opacity: 0.8;
        transition: all 0.2s ease;
      `;

      analyzeBtn.onmouseover = function () {
        this.style.opacity = '1';
        this.style.transform = 'scale(1.1)';
      };

      analyzeBtn.onmouseout = function () {
        this.style.opacity = '0.8';
        this.style.transform = 'scale(1)';
      };

      analyzeBtn.onclick = function (e) {
        e.preventDefault();
        e.stopPropagation();

        // Obter o conteúdo selecionado
        const selectedTextDiv = document.querySelector('#miniChatMessages [style*="border-left: 3px solid #ffd93d"]');
        if (!selectedTextDiv) {
          showFeedback('Nenhum conteúdo selecionado para analisar', 'error');
          return;
        }

        const selectedText = selectedTextDiv.textContent
          .replace('CONTEÚDO SELECIONADO', '')
          .replace('IMAGENS', '')
          .trim();

        if (!selectedText) {
          showFeedback('Texto selecionado vazio', 'error');
          return;
        }

        // Obter o input e enviar comando de análise
        const input = document.getElementById('miniChatInput');
        const messagesContainer = document.getElementById('miniChatMessages');

        if (input && messagesContainer) {
          // Escolher um comando de análise aleatório
          const analyzeCommands = [
            `Analise este texto: "${selectedText.substring(0, 100)}${selectedText.length > 100 ? '...' : ''}"`,
            `Explique o significado deste conteúdo`,
            `Resuma os principais pontos deste texto`,
            `Identifique os conceitos chave neste conteúdo`,
            `Explique este texto de forma simples`
          ];

          const randomCommand = analyzeCommands[Math.floor(Math.random() * analyzeCommands.length)];
          input.value = randomCommand;

          // Simular envio após um pequeno delay
          setTimeout(() => {
            // Simular evento de tecla Enter
            const event = new KeyboardEvent('keydown', {
              key: 'Enter',
              code: 'Enter',
              keyCode: 13,
              which: 13,
              bubbles: true
            });
            input.dispatchEvent(event);

            // Alternativa: chamar diretamente a função de envio
            if (typeof sendToMiniChat === 'function') {
              sendToMiniChat(randomCommand, messagesContainer);
            }
          }, 100);
        }
      };

      // Adicionar botão ao cabeçalho
    }

    // Função para tornar o Mini Chat arrastável
    function makeMiniChatDraggable() {
      const header = document.getElementById('miniChatHeader');
      const container = document.getElementById('miniChatContainer');

      if (!header || !container) return;

      let isDragging = false;
      let currentX;
      let currentY;
      let initialX;
      let initialY;
      let xOffset = 0;
      let yOffset = 0;

      header.addEventListener('mousedown', dragStart);
      document.addEventListener('mousemove', drag);
      document.addEventListener('mouseup', dragEnd);

      function dragStart(e) {
        initialX = e.clientX - xOffset;
        initialY = e.clientY - yOffset;

        if (e.target === header || header.contains(e.target)) {
          isDragging = true;
          header.style.cursor = 'grabbing';
        }
      }

      function drag(e) {
        if (isDragging) {
          e.preventDefault();
          currentX = e.clientX - initialX;
          currentY = e.clientY - initialY;

          xOffset = currentX;
          yOffset = currentY;

          // Limitar às bordas da tela
          const maxX = window.innerWidth - container.offsetWidth;
          const maxY = window.innerHeight - container.offsetHeight;

          currentX = Math.max(0, Math.min(currentX, maxX));
          currentY = Math.max(0, Math.min(currentY, maxY));

          container.style.left = currentX + 'px';
          container.style.top = currentY + 'px';
        }
      }

      function dragEnd() {
        initialX = currentX;
        initialY = currentY;
        isDragging = false;
        header.style.cursor = 'move';
      }
    }

    // Função para atualizar display de imagens no mini chat
    function updateMiniChatImages() {
      const messagesContainer = document.getElementById('miniChatMessages');
      if (!messagesContainer || !window.miniChatSelectedImages) return;

      // Encontrar a div de conteúdo selecionado
      const contentDiv = messagesContainer.querySelector('[style*="border-left: 3px solid #ffd93d"]');
      if (!contentDiv) return;

      // Verificar se já existe seção de imagens
      let imageSection = contentDiv.querySelector('[style*="margin-top: 8px"]');

      if (window.miniChatSelectedImages.length > 0) {
        const imageHTML = `
          <div style="margin-top: 8px;">
            <div style="color: #ffd93d; font-size: 9px; font-weight: 600; margin-bottom: 5px;">
              <i class="fas fa-image"></i> IMAGENS CAPTURADAS (${window.miniChatSelectedImages.length}/3)
            </div>
            <div style="display: flex; gap: 5px; flex-wrap: wrap;">
              ${window.miniChatSelectedImages.map((img, index) => `
                <div style="position: relative;">
                  <img src="${img.src}" alt="${img.alt}" style="
                    max-width: 60px;
                    max-height: 60px;
                    border-radius: 4px;
                    object-fit: cover;
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    cursor: pointer;
                    transition: transform 0.2s ease;
                  " onclick="openImagePreview('${img.src.replace(/'/g, "\\'")}', '${img.alt.replace(/'/g, "\\'")}');"
                  onmouseover="this.style.transform='scale(1.1)'"
                  onmouseout="this.style.transform='scale(1)'" />
                  <div style="
                    position: absolute;
                    bottom: -2px;
                    right: -2px;
                    background: #ffd93d;
                    color: #333;
                    border-radius: 50%;
                    width: 16px;
                    height: 16px;
                    font-size: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: bold;
                  ">${index + 1}</div>
                </div>
              `).join('')}
            </div>
          </div>
        `;

        if (imageSection) {
          imageSection.outerHTML = imageHTML;
        } else {
          contentDiv.insertAdjacentHTML('beforeend', imageHTML);
        }
      }
    }

    // Função para configurar drag and drop de imagens
    function setupImageDragDrop() {
      const inputArea = document.getElementById('miniChatInputArea');
      const messagesContainer = document.getElementById('miniChatMessages');

      if (!inputArea) return;

      // Prevenir comportamento padrão
      ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        inputArea.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
      });

      // Destacar área de drop
      ['dragenter', 'dragover'].forEach(eventName => {
        inputArea.addEventListener(eventName, highlight, false);
      });

      ['dragleave', 'drop'].forEach(eventName => {
        inputArea.addEventListener(eventName, unhighlight, false);
      });

      // Lidar com drop
      inputArea.addEventListener('drop', handleDrop, false);

      function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
      }

      function highlight() {
        inputArea.style.background = 'rgba(255, 217, 61, 0.2)';
        inputArea.style.borderTop = '2px dashed #ffd93d';
      }

      function unhighlight() {
        inputArea.style.background = 'rgba(255, 255, 255, 0.05)';
        inputArea.style.borderTop = '1px solid rgba(255, 255, 255, 0.15)';
      }

      function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;

        handleFiles(files);
      }

      function handleFiles(files) {
        [...files].forEach(uploadFile);
      }

      function uploadFile(file) {
        if (file.type.startsWith('image/')) {
          // Verificar limite de imagens antes de processar
          const currentUploadedImages = window.miniChatUploadedImages || [];
          const currentSelectedImages = window.miniChatSelectedImages || [];
          const totalImages = currentUploadedImages.length + currentSelectedImages.length;

          if (totalImages >= 3) {
            // Mostrar mensagem de limite atingido acima do preview existente
            const filePreview = document.getElementById('miniChatFilePreview');
            if (filePreview) {
              // Verificar se já existe uma mensagem de limite
              const existingLimitMessage = filePreview.querySelector('.mini-chat-limit-message');
              if (existingLimitMessage) {
                existingLimitMessage.remove();
              }

              // Criar mensagem de limite
              const limitMessage = document.createElement('div');
              limitMessage.className = 'mini-chat-limit-message';
              limitMessage.style.cssText = `
                background: rgba(255, 107, 107, 0.2);
                border: 1px solid #ff6b6b;
                border-radius: 8px;
                padding: 8px 12px;
                color: #ff6b6b;
                font-size: 11px;
                text-align: center;
                margin-bottom: 8px;
                animation: fadeInUp 0.3s ease;
                order: -1;
              `;
              limitMessage.innerHTML = '🚫 Limite máximo de 3 imagens atingido';

              // Inserir mensagem no início do preview (acima das imagens)
              filePreview.insertBefore(limitMessage, filePreview.firstChild);
              filePreview.style.display = 'flex';
              filePreview.style.flexDirection = 'column';

              // Remover mensagem após 4 segundos
              setTimeout(() => {
                if (limitMessage.parentNode) {
                  limitMessage.remove();
                }
              }, 4000);
            }
            return; // Não processar a imagem
          }

          const reader = new FileReader();
          reader.onload = function (e) {
            const filePreview = document.getElementById('miniChatFilePreview');

            // Mostrar área de preview se estiver oculta
            if (filePreview.style.display === 'none') {
              filePreview.style.display = 'flex';
              filePreview.style.flexDirection = 'column';
              filePreview.style.gap = '8px';
              filePreview.style.justifyContent = 'center';
              filePreview.style.position = 'fixed';
              filePreview.style.bottom = '130px';
              filePreview.style.left = '50%';
              filePreview.style.transform = 'translateX(-50%)';
              filePreview.style.maxHeight = '200px';
            }

            // Garantir que o container de imagens existe
            let imagesContainer = filePreview.querySelector('.mini-chat-images-container');
            if (!imagesContainer) {
              imagesContainer = document.createElement('div');
              imagesContainer.className = 'mini-chat-images-container';
              imagesContainer.style.cssText = `
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                justify-content: center;
              `;
              filePreview.appendChild(imagesContainer);
            }

            // Criar elemento de preview
            const previewItem = document.createElement('div');
            previewItem.className = 'mini-chat-image-preview';
            previewItem.style.position = 'relative';
            previewItem.style.display = 'inline-block';
            previewItem.style.margin = '5px';

            // Criar imagem em miniatura
            const img = document.createElement('img');
            img.src = e.target.result;
            img.alt = file.name;
            img.style.width = '60px';
            img.style.height = '60px';
            img.style.objectFit = 'cover';
            img.style.borderRadius = '5px';
            img.style.cursor = 'pointer';
            img.style.border = '2px solid rgba(255, 217, 61, 0.5)';
            img.onclick = () => openImagePreview(e.target.result, file.name);

            // Botão para remover imagem
            const removeBtn = document.createElement('button');
            removeBtn.innerHTML = '×';
            removeBtn.style.position = 'absolute';
            removeBtn.style.top = '-5px';
            removeBtn.style.right = '-5px';
            removeBtn.style.background = '#ff6b6b';
            removeBtn.style.color = 'white';
            removeBtn.style.border = 'none';
            removeBtn.style.borderRadius = '50%';
            removeBtn.style.width = '20px';
            removeBtn.style.height = '20px';
            removeBtn.style.fontSize = '12px';
            removeBtn.style.cursor = 'pointer';
            removeBtn.style.display = 'flex';
            removeBtn.style.alignItems = 'center';
            removeBtn.style.justifyContent = 'center';

            // Adicionar evento para remover imagem
            removeBtn.onclick = (evt) => {
              evt.stopPropagation();
              previewItem.remove();

              // Remover da lista de imagens
              if (window.miniChatUploadedImages) {
                window.miniChatUploadedImages = window.miniChatUploadedImages.filter(
                  img => img.src !== e.target.result
                );
              }

              // Esconder preview se não houver mais imagens no container
              const imagesContainer = filePreview.querySelector('.mini-chat-images-container');
              if (imagesContainer && imagesContainer.children.length === 0) {
                filePreview.style.display = 'none';
              }
            };

            // Montar preview
            previewItem.appendChild(img);
            previewItem.appendChild(removeBtn);

            // Adicionar ao container de imagens
            imagesContainer.appendChild(previewItem);

            // Armazenar imagem para envio com próxima mensagem
            if (!window.miniChatUploadedImages) {
              window.miniChatUploadedImages = [];
            }
            window.miniChatUploadedImages.push({
              src: e.target.result,
              name: file.name
            });
          };
          reader.readAsDataURL(file);
        }
      }
    }

    // Função para abrir preview de imagem (global)
    window.openImagePreview = function (src, alt) {
      const preview = document.createElement('div');
      preview.innerHTML = `
        <div style="
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.8);
          z-index: 1000003;
          display: flex;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(5px);
        " onclick="this.remove()">
          <div style="
            max-width: 90%;
            max-height: 90%;
            position: relative;
          ">
            <img src="${src}" alt="${alt}" style="
              max-width: 100%;
              max-height: 100%;
              border-radius: 8px;
              box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
            " />
            <button onclick="this.parentElement.parentElement.remove()" style="
              position: absolute;
              top: 10px;
              right: 10px;
              background: rgba(0, 0, 0, 0.7);
              color: white;
              border: none;
              border-radius: 50%;
              width: 30px;
              height: 30px;
              cursor: pointer;
              font-size: 14px;
            ">×</button>
          </div>
        </div>
      `;
      document.body.appendChild(preview);
    };

    // Função para fechar Mini KEN Chat (global)
    window.closeMiniKenChat = function () {
      const miniChat = document.getElementById('kenMiniChat');
      if (miniChat) {
        miniChat.style.animation = 'miniChatSlideOut 0.3s ease-in';
        setTimeout(() => {
          miniChat.remove();
        }, 300);
      }
    };

    // Função para debug de imagens no Mini Chat (global)
    window.debugMiniChatImages = function () {
      console.log('=== DEBUG MINI CHAT IMAGES ===');
      console.log('Imagens armazenadas:', window.miniChatSelectedImages);
      console.log('Imagens enviadas:', window.miniChatUploadedImages);

      const selection = window.getSelection();
      console.log('Seleção atual:', selection);
      console.log('Ranges:', selection.rangeCount);

      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        console.log('Range:', range);

        // Testar todos os métodos de captura
        const tempDiv = document.createElement('div');
        tempDiv.appendChild(range.cloneContents());
        const images = tempDiv.querySelectorAll('img');
        console.log('Imagens no range clonado:', images.length);

        // Listar todas as imagens da página
        const allImages = document.querySelectorAll('img');
        console.log('Total de imagens na página:', allImages.length);

        allImages.forEach((img, i) => {
          const rect = img.getBoundingClientRect();
          console.log(`Imagem ${i + 1}:`, {
            src: img.src,
            alt: img.alt,
            visible: rect.width > 0 && rect.height > 0,
            rect: rect
          });
        });
      }

      // Forçar captura de imagens próximas
      forceImageCapture();

      // Forçar atualização do display
      updateMiniChatImages();
    };

    // Função para forçar a captura de imagens (global)
    window.forceImageCapture = function () {
      forceImageCapture();
    };

    // Função para forçar captura de imagens próximas à seleção
    function forceImageCapture() {
      console.log('Forçando captura de imagens...');
      const selection = window.getSelection();

      if (!selection || selection.rangeCount === 0) {
        console.warn('Nenhuma seleção ativa para capturar imagens');
        return;
      }

      const range = selection.getRangeAt(0);
      const selectionRect = range.getBoundingClientRect();

      // Inicializar array de imagens se não existir
      if (!window.miniChatSelectedImages) {
        window.miniChatSelectedImages = [];
      }

      // Buscar todas as imagens visíveis na página
      const allImages = Array.from(document.querySelectorAll('img')).filter(img => {
        const imgRect = img.getBoundingClientRect();
        return imgRect.width > 0 && imgRect.height > 0 && img.src;
      });

      console.log('Total de imagens visíveis:', allImages.length);

      // Verificar imagens próximas à seleção (distância aumentada para 300px)
      let foundImages = 0;
      allImages.forEach(img => {
        // Parar se já temos 3 imagens
        if (window.miniChatSelectedImages.length >= 3) {
          return;
        }
        const imgRect = img.getBoundingClientRect();

        // Calcular centro da imagem e da seleção
        const imgCenterX = imgRect.left + imgRect.width / 2;
        const imgCenterY = imgRect.top + imgRect.height / 2;
        const selCenterX = selectionRect.left + selectionRect.width / 2;
        const selCenterY = selectionRect.top + selectionRect.height / 2;

        // Calcular distância entre os centros
        const distance = Math.sqrt(
          Math.pow(imgCenterX - selCenterX, 2) +
          Math.pow(imgCenterY - selCenterY, 2)
        );

        // Verificar se a imagem está próxima (300px) ou intersecta
        const intersects = !(imgRect.right < selectionRect.left ||
          imgRect.left > selectionRect.right ||
          imgRect.bottom < selectionRect.top ||
          imgRect.top > selectionRect.bottom);

        if ((distance < 300 || intersects) && img.src) {
          console.log(`Imagem próxima encontrada: ${img.src}, distância: ${distance.toFixed(2)}px`);

          // Evitar duplicatas e limitar a 3 imagens
          const alreadyAdded = window.miniChatSelectedImages.some(existing => existing.src === img.src);

          if (!alreadyAdded && window.miniChatSelectedImages.length < 3) {
            window.miniChatSelectedImages.push({
              src: img.src,
              alt: img.alt || 'Imagem capturada',
              width: img.width || 'auto',
              height: img.height || 'auto'
            });
            foundImages++;
          }
        }
      });

      console.log(`Captura forçada encontrou ${foundImages} novas imagens`);
      console.log('Total de imagens após captura:', window.miniChatSelectedImages.length);

      // Atualizar display
      updateMiniChatImages();

      // Adicionar botão de captura manual se não existir
      addCaptureButton();

      // Atualizar botão de captura
      updateCaptureButton();
    }

    // Função para adicionar botão de captura manual
    function addCaptureButton() {
      const miniChat = document.getElementById('miniChatQuickActions');
      if (!miniChat) return;

      // Verificar se o botão já existe
      if (document.getElementById('forceCaptureBtn')) return;

      const captureBtn = document.createElement('button');
      captureBtn.id = 'forceCaptureBtn';

      // Atualizar texto baseado no limite
      const currentCount = window.miniChatSelectedImages ? window.miniChatSelectedImages.length : 0;
      if (currentCount >= 3) {
        captureBtn.innerHTML = '<i class="fas fa-ban"></i> Limite Atingido (3/3)';
        captureBtn.style.opacity = '0.5';
        captureBtn.style.cursor = 'not-allowed';
      } else {
        captureBtn.innerHTML = `<i class="fas fa-camera"></i> Capturar Imagens (${currentCount}/3)`;
      }
      captureBtn.style.cssText = `
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 15px;
        padding: 6px 10px;
        color: white;
        font-size: 10px;
        cursor: pointer;
        transition: all 0.2s ease;
        font-family: 'Inter', sans-serif;
      `;

      captureBtn.onmouseover = function () {
        this.style.background = 'rgba(255, 255, 255, 0.2)';
      };

      captureBtn.onmouseout = function () {
        this.style.background = 'rgba(255, 255, 255, 0.1)';
      };

      captureBtn.onclick = function () {
        if (window.miniChatSelectedImages && window.miniChatSelectedImages.length >= 3) {
          showFeedback('Limite de 3 imagens já atingido', 'warning');
          return;
        }
        forceImageCapture();
        showFeedback('Buscando imagens próximas...', 'info');
      };

      miniChat.appendChild(captureBtn);
    }

    // Função para atualizar o botão de captura
    function updateCaptureButton() {
      const captureBtn = document.getElementById('forceCaptureBtn');
      if (!captureBtn) return;

      const currentCount = window.miniChatSelectedImages ? window.miniChatSelectedImages.length : 0;
      if (currentCount >= 3) {
        captureBtn.innerHTML = '<i class="fas fa-ban"></i> Limite Atingido (3/3)';
        captureBtn.style.opacity = '0.5';
        captureBtn.style.cursor = 'not-allowed';
      } else {
        captureBtn.innerHTML = `<i class="fas fa-camera"></i> Capturar Imagens (${currentCount}/3)`;
        captureBtn.style.opacity = '1';
        captureBtn.style.cursor = 'pointer';
      }
    }

    // Função para ação rápida no Mini Chat (global)
    window.quickMiniAction = function (action) {
      const input = document.getElementById('miniChatInput');
      if (input) {
        input.value = action + ' ';
        input.focus();
        // Posicionar cursor no final
        input.setSelectionRange(input.value.length, input.value.length);
      }
    };

    // Função para enviar mensagem no Mini Chat (global)
    window.sendMiniChatMessage = function () {
      const input = document.getElementById('miniChatInput');
      const messagesContainer = document.getElementById('miniChatMessages');
      const quickActions = document.getElementById('miniChatQuickActions');

      if (!input || !messagesContainer) return;

      const message = input.value.trim();
      if (!message) return;

      // Verificar se há imagens para incluir no histórico
      const miniChatSelectedImages = window.miniChatSelectedImages || [];
      const miniChatUploadedImages = window.miniChatUploadedImages || [];

      // Esconder botões de ação rápida após primeira mensagem
      if (quickActions && quickActions.style.display !== 'none') {
        quickActions.style.opacity = '0';
        quickActions.style.transform = 'translateY(-10px)';
        setTimeout(() => {
          quickActions.style.display = 'none';
        }, 300);
      }

      // Verificar se há imagens para mostrar o contador
      const selectedImages = window.miniChatSelectedImages || [];
      const uploadedImages = window.miniChatUploadedImages || [];
      const allImages = [...selectedImages, ...uploadedImages];

      // Preparar mensagem com contador de imagens
      let displayMessage = message;
      if (allImages.length > 0) {
        displayMessage += ` <span style="color: #ffd93d; font-size: 10px;">[${allImages.length} ${allImages.length === 1 ? 'imagem fixada' : 'imagens fixadas'}]</span>`;
      }

      // Adicionar mensagem do usuário
      const userMessage = document.createElement('div');
      userMessage.innerHTML = `
        <div style="
          display: flex;
          justify-content: flex-end;
          margin-bottom: 10px;
          animation: slideInRight 0.3s ease-out;
        ">
          <div style="
            background: rgba(255, 255, 255, 0.2);
            color: white;
            padding: 8px 12px;
            border-radius: 12px;
            max-width: 80%;
            font-size: 11px;
            line-height: 1.4;
            border-bottom-right-radius: 4px;
          ">
            ${displayMessage}
          </div>
        </div>
      `;
      messagesContainer.appendChild(userMessage);

      // Renderizar matemática com KaTeX na mensagem do usuário
      setTimeout(() => {
        if (window.katex && window.renderMathInElement && window.katexReady) {
          try {
            window.renderMathInElement(userMessage, {
              delimiters: [
                { left: '$$', right: '$$', display: true },
                { left: '$', right: '$', display: false },
                { left: '\\[', right: '\\]', display: true },
                { left: '\\(', right: '\\)', display: false },
              ],
              throwOnError: false,
              errorColor: '#ff6b6b',
              strict: false,
            });
            console.log('Matemática renderizada na mensagem do usuário - Mini Chat');
          } catch (err) {
            console.warn('Erro ao renderizar matemática na mensagem do usuário - Mini Chat:', err);
          }
        }
      }, 100);

      // Limpar input
      input.value = '';
      input.style.height = '35px';

      // Limpar área de preview
      const filePreview = document.getElementById('miniChatFilePreview');
      if (filePreview) {
        filePreview.innerHTML = '';
        filePreview.style.display = 'none';
      }

      // Scroll para baixo
      messagesContainer.scrollTop = messagesContainer.scrollHeight;

      // Mostrar loading
      const loadingMessage = document.createElement('div');
      loadingMessage.id = 'miniChatLoading';
      loadingMessage.innerHTML = `
        <div style="
          display: flex;
          justify-content: flex-start;
          margin-bottom: 10px;
        ">
          <div style="
            background: rgba(0, 0, 0, 0.2);
            color: white;
            padding: 8px 12px;
            border-radius: 12px;
            max-width: 80%;
            font-size: 11px;
            border-bottom-left-radius: 4px;
            display: flex;
            align-items: center;
            gap: 8px;
          ">
            <div style="
              width: 12px;
              height: 12px;
              border: 2px solid rgba(255, 255, 255, 0.3);
              border-top: 2px solid white;
              border-radius: 50%;
              animation: spin 1s linear infinite;
            "></div>
            Pensando...
          </div>
        </div>
      `;
      messagesContainer.appendChild(loadingMessage);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;

      // Enviar para IA (usando a mesma função do painel principal)
      sendToMiniChat(message, messagesContainer);
    };

    // Função para enviar para IA no Mini Chat
    async function sendToMiniChat(message, messagesContainer) {
      try {
        // Obter texto selecionado do contexto
        const selectedTextDiv = messagesContainer.querySelector(
          '[style*="border-left: 3px solid #ffd93d"]'
        );
        const selectedText = selectedTextDiv
          ? selectedTextDiv.textContent.replace('CONTEÚDO SELECIONADO', '').replace('IMAGENS', '').trim()
          : '';

        // Obter imagens selecionadas e enviadas
        const selectedImages = window.miniChatSelectedImages || [];
        const uploadedImages = window.miniChatUploadedImages || [];
        const allImages = [...selectedImages, ...uploadedImages];

        // Adicionar mensagem do usuário ao histórico
        miniChatHistory.push({
          role: 'user',
          parts: [{ text: message }]
        });

        // Criar contexto com texto e imagens
        let contextMessage = '';

        // Verificar se temos contexto avançado disponível
        if (window.miniKenContext) {
          // Usar função de aprimoramento de prompt com contexto
          contextMessage = enhancePromptWithContext(message, window.miniKenContext);
        } else if (selectedText) {
          // Fallback para o método antigo
          contextMessage += `CONTEXTO DO CONTEÚDO SELECIONADO:\n"${selectedText}"\n\n`;
        }

        // Limitar a 3 imagens máximo
        const limitedImages = allImages.slice(0, 3);

        // Adicionar indicação de imagens anexadas
        let messageWithImageCount = message;
        if (limitedImages.length > 0) {
          messageWithImageCount += ` [${limitedImages.length} ${limitedImages.length === 1 ? 'imagem fixada' : 'imagens fixadas'}]`;
          if (allImages.length > 3) {
            messageWithImageCount += ` (${allImages.length - 3} imagens ignoradas - limite de 3)`;
          }
        }

        // Criar mensagem de contexto apenas se não foi criada pelo enhancePromptWithContext
        if (!window.miniKenContext) {
          contextMessage += `PERGUNTA DO USUÁRIO: ${messageWithImageCount}`;
        }

        console.log('Contexto enviado para IA:', contextMessage);
        console.log('Imagens a serem enviadas:', limitedImages.length);
        if (allImages.length > 3) {
          console.log(`${allImages.length - 3} imagens ignoradas (limite de 3)`);
        }

        // Limpar imagens enviadas após uso
        window.miniChatUploadedImages = [];

        // Limpar contexto após uso para evitar reutilização indesejada
        window.miniKenContext = null;

        // Usar sistema de API com fallback (mesmo do painel principal)
        let response = '';

        // Verificar se apiKeyManager está disponível
        if (!window.apiKeyManager && typeof apiKeyManager === 'undefined') {
          throw new Error('Sistema de gerenciamento de API não disponível');
        }

        const keyManager = window.apiKeyManager || apiKeyManager;

        for (let attempt = 0; attempt < API_KEYS.length; attempt++) {
          try {
            const currentKey = keyManager.getNextAvailableKey();

            // Preparar partes da mensagem
            let parts = [{ text: contextMessage }];

            // Adicionar imagens como inline_data (máximo 3 imagens)
            if (limitedImages.length > 0) {
              for (let i = 0; i < limitedImages.length; i++) {
                const img = limitedImages[i];

                try {
                  // Converter URL da imagem para base64
                  let imgData;

                  if (img.src.startsWith('data:')) {
                    // Já é base64
                    imgData = img.src.split(',')[1];
                  } else {
                    // Buscar imagem e converter para base64
                    const imgFile = await urlToFile(img.src, `selected_image_${i + 1}.jpg`);
                    imgData = await fileToBase64(imgFile);
                  }

                  // Adicionar imagem como parte da mensagem
                  parts.push({
                    inline_data: {
                      mime_type: 'image/jpeg',
                      data: imgData
                    }
                  });

                  console.log(`Imagem ${i + 1} adicionada ao payload da API`);
                } catch (imgError) {
                  console.error(`Erro ao processar imagem ${i + 1}:`, imgError);
                }
              }
            }

            // Preparar o histórico de conversas para enviar à API
            const historyContents = miniChatHistory.map(msg => ({
              role: msg.role,
              parts: msg.parts
            }));

            // Adicionar a mensagem atual ao histórico para a API
            const currentUserMessage = {
              role: 'user',
              parts: parts
            };

            // Log detalhado do histórico
            console.log('Enviando histórico para API:', JSON.stringify(historyContents));
            console.log('Total de mensagens no histórico:', historyContents.length);
            console.log('Mensagem atual:', JSON.stringify(currentUserMessage));

            // Adicionar prompt de sistema para mini chat
            const miniSystemPrompt = {
              role: 'user',
              parts: [{
                text: `🤖 KEN AI MINI - ESPECIALISTA EM ANÁLISE DE CONTEÚDO:
Você é o KEN AI Mini, especializado em analisar e explicar conteúdo selecionado pelo usuário com excelência acadêmica.

🔥 MISSÃO: Transformar qualquer conteúdo em aprendizado claro e efetivo!

📐 REGRAS MATEMÁTICAS OBRIGATÓRIAS (CRÍTICO):
• SEMPRE use LaTeX para QUALQUER matemática
• $expressão$ = inline | $$expressão$$ = bloco
• NUNCA escreva matemática sem LaTeX

💡 ESTILO: Entusiasta, didático, motivador e extremamente claro!`
              }]
            };

            const apiResponse = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${currentKey}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [miniSystemPrompt, ...historyContents, currentUserMessage],
                  generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 2048,
                  },
                }),
              }
            );

            if (apiResponse.ok) {
              const data = await apiResponse.json();
              console.log('Resposta da API:', data); // Debug

              if (
                data.candidates &&
                data.candidates[0] &&
                data.candidates[0].content &&
                data.candidates[0].content.parts &&
                data.candidates[0].content.parts[0]
              ) {
                response = data.candidates[0].content.parts[0].text;
                console.log('Texto da resposta:', response); // Debug

                if (response && response.trim()) {
                  keyManager.markKeySuccess(currentKey);
                  break;
                } else {
                  throw new Error('Texto da resposta vazio');
                }
              } else {
                console.log('Estrutura de resposta inválida:', data); // Debug
                throw new Error('Estrutura de resposta inválida da API');
              }
            } else {
              const errorText = await apiResponse.text();
              console.log('Erro da API:', apiResponse.status, errorText); // Debug
              keyManager.markKeyFailure(currentKey);
              throw new Error(`API Error: ${apiResponse.status} - ${errorText}`);
            }
          } catch (apiError) {
            console.warn(`Tentativa ${attempt + 1} falhou:`, apiError);
            if (attempt === API_KEYS.length - 1) {
              throw apiError;
            }
          }
        }

        // Verificar se obtivemos uma resposta válida
        if (!response || response.trim() === '') {
          throw new Error('Resposta vazia da IA');
        }

        // Remover loading
        const loading = document.getElementById('miniChatLoading');
        if (loading) loading.remove();

        // Adicionar resposta da IA
        const aiMessage = document.createElement('div');
        aiMessage.innerHTML = `
          <div style="
            display: flex;
            justify-content: flex-start;
            margin-bottom: 10px;
            animation: slideInLeft 0.3s ease-out;
          ">
            <div style="
              background: rgba(0, 0, 0, 0.2);
              color: white;
              padding: 8px 12px;
              border-radius: 12px;
              max-width: 80%;
              font-size: 11px;
              line-height: 1.4;
              border-bottom-left-radius: 4px;
            ">
              ${formatMiniChatMarkdown(response)}
            </div>
          </div>
        `;
        messagesContainer.appendChild(aiMessage);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        // Renderizar matemática com KaTeX no mini chat
        setTimeout(() => {
          if (window.katex && window.renderMathInElement && window.katexReady) {
            try {
              window.renderMathInElement(aiMessage, {
                delimiters: [
                  { left: '$$', right: '$$', display: true },
                  { left: '$', right: '$', display: false },
                  { left: '\\[', right: '\\]', display: true },
                  { left: '\\(', right: '\\)', display: false },
                ],
                throwOnError: false,
                errorColor: '#ff6b6b',
                strict: false,
              });
              console.log('Matemática renderizada com KaTeX no Mini Chat');
            } catch (err) {
              console.warn('Erro ao renderizar matemática no Mini Chat:', err);
            }
          }
        }, 200);

        // Adicionar resposta da IA ao histórico
        miniChatHistory.push({
          role: 'model',
          parts: [{ text: response }]
        });

        // Salvar histórico
        saveMiniChatHistory();
      } catch (error) {
        console.error('Erro no Mini Chat:', error);

        // Remover loading
        const loading = document.getElementById('miniChatLoading');
        if (loading) loading.remove();

        // Determinar tipo de erro e mensagem
        let errorTitle = 'Erro na conexão';
        let errorDetails = 'Verifique sua conexão e tente novamente';

        if (error.message.includes('API Error: 429')) {
          errorTitle = 'Muitas solicitações';
          errorDetails = 'Aguarde um momento antes de tentar novamente';
        } else if (error.message.includes('API Error: 403')) {
          errorTitle = 'Acesso negado';
          errorDetails = 'Problema com a chave da API';
        } else if (error.message.includes('Resposta vazia')) {
          errorTitle = 'Resposta vazia';
          errorDetails = 'A IA não conseguiu gerar uma resposta';
        }

        // Mostrar erro com informações específicas
        const errorMessage = document.createElement('div');
        errorMessage.innerHTML = `
          <div style="
            display: flex;
            justify-content: flex-start;
            margin-bottom: 10px;
            animation: slideInLeft 0.3s ease-out;
          ">
            <div style="
              background: rgba(255, 107, 107, 0.2);
              color: #ff6b6b;
              padding: 8px 12px;
              border-radius: 12px;
              max-width: 80%;
              font-size: 11px;
              line-height: 1.4;
              border-bottom-left-radius: 4px;
              border: 1px solid rgba(255, 107, 107, 0.4);
            ">
              <div style="margin-bottom: 5px; font-weight: 600;">
                <i class="fas fa-exclamation-triangle"></i> ${errorTitle}
              </div>
              <div style="font-size: 10px; opacity: 0.9;">
                ${errorDetails}
              </div>
            </div>
          </div>
        `;
        messagesContainer.appendChild(errorMessage);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    }

    // Função para executar ação AI do menu (global)
    window.executeAiAction = function (action, text) {
      console.log('Executando ação AI:', action, text);
      const panel = document.getElementById('kenAiPanel');
      const input = document.getElementById('kenAiInput');

      if (panel && input) {
        // Abrir painel
        panel.classList.add('open');
        panel.style.right = '0';

        // Inserir comando com texto
        input.value = `${action} ${text}`;
        input.focus();

        // Remover tooltip
        const tooltip = document.getElementById('kenAiTooltip');
        if (tooltip) tooltip.remove();

        // Adicionar animação
        input.classList.add('command-inserted');
        setTimeout(() => {
          input.classList.remove('command-inserted');
        }, 600);
      }
    };

    // Função para inserir comando no input
    function insertCommand(command) {
      const input = document.getElementById('kenAiInput');
      if (input) {
        input.value = command;
        input.focus();
        // Posicionar cursor no final
        input.setSelectionRange(input.value.length, input.value.length);

        // Adicionar animação de comando inserido
        input.classList.add('command-inserted');
        setTimeout(() => {
          input.classList.remove('command-inserted');
        }, 600);
      }
    }

    // Tornar função global para uso nos onclick
    window.insertCommand = insertCommand;

    // Inicializar
    initVoice();

    // Adicionar global para acesso aos arquivos
    window.currentFile = null;

    // Inicializar funcionalidades que dependem dos elementos DOM
    setupCommandSuggestions();
    setupPlaceholderUpdate();
    initImageDragDrop();
  }

  // Criar botão flutuante
  function createFloatingButton() {
    const floatingBtn = document.createElement('button');
    floatingBtn.className = 'ken-ai-floating-btn';
    floatingBtn.innerHTML = '<i class="fas fa-robot"></i>';
    floatingBtn.title = 'Abrir KEN AI (Alt+K)';

    floatingBtn.addEventListener('click', () => {
      const panel = document.getElementById('kenAiPanel');
      if (panel) {
        const isOpen = panel.classList.contains('open');
        panel.classList.toggle('open');

        // Atualizar posição do botão
        if (!isOpen) {
          floatingBtn.classList.add('panel-open');
          setTimeout(() => {
            const input = document.getElementById('kenAiInput');
            if (input) input.focus();
          }, 400);
        } else {
          floatingBtn.classList.remove('panel-open');
        }
      }
    });

    document.body.appendChild(floatingBtn);
    return floatingBtn;
  }

  // Inicializar o painel
  initializePanel().then(() => {
    createFloatingButton();
  });

  console.log('🎓 KEN AI carregado com sucesso!');
  console.log('💡 Atalhos: Alt+K para abrir/fechar | Escape para fechar');
  console.log('✨ Selecione texto na página para explicação rápida!');

  // Log adicional para verificar escopo global
  window.addEventListener('load', () => {
    console.log('Página completamente carregada');
    console.log('Painel existe:', !!document.getElementById('kenAiPanel'));
    console.log('Input existe:', !!document.getElementById('kenAiInput'));
  });

  // Auto-resize movido para dentro de setupEventListeners

  // Detectar mudanças na página para reposicionar elementos se necessário
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        // Verificar se o painel ainda está no DOM
        if (!document.getElementById('kenAiPanel')) {
          // Recriar o painel se foi removido
          console.warn('Painel KEN AI foi removido, recriando...');
          initializePanel();
        }
      }
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Função para lidar com erros de API
  function handleApiError(error) {
    console.error('Erro na API:', error);
    return 'Desculpe, houve um problema com a API. Tente novamente em alguns segundos.';
  }

  // Função para verificar se a API está funcionando
  async function checkApiHealth() {
    try {
      const response = await sendToGemini('Teste de conexão', null);
      return response && response.length > 0;
    } catch (error) {
      return false;
    }
  }

  // Adicionar função de feedback visual
  function showFeedback(message, type = 'info') {
    const feedback = document.createElement('div');
    feedback.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'error' ? '#ef4444' : '#10b981'};
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        font-size: 14px;
        z-index: 1000001;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        animation: slideIn 0.3s ease;
    `;

    feedback.textContent = message;
    document.body.appendChild(feedback);

    setTimeout(() => {
      feedback.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => feedback.remove(), 300);
    }, 3000);
  }

  // Adicionar animações CSS
  const animationStyles = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }

    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;

  const animationSheet = document.createElement('style');
  animationSheet.textContent = animationStyles;
  document.head.appendChild(animationSheet);

  // Função para salvar histórico localmente
  function saveHistory() {
    try {
      localStorage.setItem('kenAiHistory', JSON.stringify(chatHistory));
    } catch (e) {
      console.warn('Não foi possível salvar o histórico:', e);
    }
  }

  // Função para carregar histórico
  function loadHistory() {
    try {
      const saved = localStorage.getItem('kenAiHistory');
      if (saved) {
        chatHistory = JSON.parse(saved);
        // Restaurar mensagens no chat
        chatHistory.forEach((msg) => {
          if (msg.role === 'user') {
            addMessage(msg.parts[0].text, true);
          } else {
            addMessage(msg.parts[0].text, false);
          }
        });
      }
    } catch (e) {
      console.warn('Não foi possível carregar o histórico:', e);
    }
  }

  // Função para processar markdown (global)
  function processMarkdown(text) {
    if (!text) return '';

    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/^\* (.*$)/gim, '<li>$1</li>')
      .replace(/^- (.*$)/gim, '<li>$1</li>')
      .replace(/^\d+\. (.*$)/gim, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/gms, '<ul>$1</ul>')
      .replace(/\n/g, '<br>');
  }

  // Função para formatar markdown simples no mini chat (global)
  function formatMiniChatMarkdown(text) {
    if (!text) return '';

    return (
      text
        // Negrito
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // Itálico
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        // Código inline
        .replace(
          /`(.*?)`/g,
          '<code style="background: rgba(255,255,255,0.1); padding: 2px 4px; border-radius: 3px; font-family: monospace;">$1</code>'
        )
        // Quebras de linha
        .replace(/\n/g, '<br>')
        // Links
        .replace(
          /\[([^\]]+)\]\(([^)]+)\)/g,
          '<a href="$2" target="_blank" style="color: #ffd93d;">$1</a>'
        )
    );
  }

  // Função para salvar histórico do Ken Mini
  function saveMiniChatHistory() {
    try {
      localStorage.setItem('kenMiniChatHistory', JSON.stringify(miniChatHistory));
      console.log('Histórico do Ken Mini salvo com sucesso');
    } catch (e) {
      console.warn('Não foi possível salvar o histórico do Ken Mini:', e);
    }
  }

  // Função para carregar histórico do Ken Mini
  function loadMiniChatHistory(messagesContainer) {
    try {
      const saved = localStorage.getItem('kenMiniChatHistory');
      if (saved && messagesContainer) {
        miniChatHistory = JSON.parse(saved);

        // Limpar mensagem inicial se houver histórico
        if (miniChatHistory.length > 0) {
          // Remover mensagem inicial se existir
          const initialMessage = messagesContainer.querySelector('.mini-chat-initial-message');
          if (initialMessage) {
            initialMessage.remove();
          }

          // Restaurar mensagens no chat mini
          miniChatHistory.forEach((msg) => {
            if (msg.role === 'user') {
              // Adicionar mensagem do usuário
              const userMessage = document.createElement('div');
              userMessage.innerHTML = `
                <div style="
                  display: flex;
                  justify-content: flex-end;
                  margin-bottom: 10px;
                  animation: slideInRight 0.3s ease-out;
                ">
                  <div style="
                    background: rgba(255, 255, 255, 0.2);
                    color: white;
                    padding: 8px 12px;
                    border-radius: 12px;
                    max-width: 80%;
                    font-size: 11px;
                    line-height: 1.4;
                    border-bottom-right-radius: 4px;
                  ">
                    ${msg.parts[0].text}
                  </div>
                </div>
              `;
              messagesContainer.appendChild(userMessage);
            } else {
              // Adicionar resposta da IA
              const aiMessage = document.createElement('div');
              aiMessage.innerHTML = `
                <div style="
                  display: flex;
                  justify-content: flex-start;
                  margin-bottom: 10px;
                  animation: slideInLeft 0.3s ease-out;
                ">
                  <div style="
                    background: rgba(0, 0, 0, 0.2);
                    color: white;
                    padding: 8px 12px;
                    border-radius: 12px;
                    max-width: 80%;
                    font-size: 11px;
                    line-height: 1.4;
                    border-bottom-left-radius: 4px;
                  ">
                    ${formatMiniChatMarkdown(msg.parts[0].text)}
                  </div>
                </div>
              `;
              messagesContainer.appendChild(aiMessage);
            }
          });

          // Scroll para baixo
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
      }
    } catch (e) {
      console.warn('Não foi possível carregar o histórico do Ken Mini:', e);
    }
  }

  // Carregar histórico ao inicializar
  // loadHistory(); // Descomente se quiser persistir o histórico

  // Função para atualizar preview de imagens
  function updateImagePreviews() {
    const previewContainer = document.getElementById('kenAiImagePreviewContainer');
    const attachButton = document.querySelector(
      '.ken-ai-action-btn[onclick="document.getElementById(\'kenAiFileInput\').click()"]'
    );
    previewContainer.innerHTML = ''; // Limpar previews anteriores

    const imageFiles = uploadedFiles.filter((file) => file.type.startsWith('image/'));

    // Adicionar mensagem de limite se atingir 3 imagens
    if (imageFiles.length >= 3) {
      const limitMessage = document.createElement('div');
      limitMessage.className = 'ken-ai-image-limit-message';
      limitMessage.textContent = '🚫 Limite máximo de 3 imagens atingido';
      previewContainer.appendChild(limitMessage);
    }

    // Criar wrapper para imagens
    const imageWrapper = document.createElement('div');
    imageWrapper.className = 'ken-ai-image-preview-wrapper';

    imageFiles.slice(0, 3).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const previewDiv = document.createElement('div');
        previewDiv.className = 'ken-ai-image-preview';

        const img = document.createElement('img');
        img.src = e.target.result;

        const removeBtn = document.createElement('button');
        removeBtn.className = 'ken-ai-image-preview-remove';
        removeBtn.innerHTML = '&times;';
        removeBtn.onclick = () => {
          uploadedFiles = uploadedFiles.filter((f) => f !== file);
          updateImagePreviews();
        };

        previewDiv.appendChild(img);
        previewDiv.appendChild(removeBtn);
        imageWrapper.appendChild(previewDiv);
      };
      reader.readAsDataURL(file);
    });

    // Adicionar wrapper de imagens ao container
    previewContainer.appendChild(imageWrapper);

    // Mostrar container
    previewContainer.style.display = imageFiles.length > 0 ? 'flex' : 'none';

    // Bloquear botão se atingir 3 imagens
    if (attachButton) {
      if (imageFiles.length >= 3) {
        attachButton.disabled = true;
        attachButton.style.opacity = '0.5';
        attachButton.style.cursor = 'not-allowed';
      } else {
        attachButton.disabled = false;
        attachButton.style.opacity = '1';
        attachButton.style.cursor = 'pointer';
      }
    }
  }

  // Função para converter URL de imagem para arquivo
  async function urlToFile(url, filename) {
    // Verificar se a URL é válida
    if (!url || typeof url !== 'string') {
      console.warn('URL inválida:', url);
      return null;
    }

    try {
      // Verificar se é uma URL de dados (data URL)
      if (url.startsWith('data:')) {
        // Converter data URL diretamente
        const response = await fetch(url);
        const blob = await response.blob();
        return new File([blob], filename || 'image.png', { type: blob.type });
      }

      // Tentar converter URL relativa para absoluta
      let absoluteUrl = url;
      if (!url.match(/^(https?:)?\/\//i)) {
        // É uma URL relativa, converter para absoluta
        const base = window.location.origin;
        absoluteUrl = new URL(url, base).href;
        console.log('URL convertida de relativa para absoluta:', url, '->', absoluteUrl);
      }

      // Tentar obter a imagem diretamente
      try {
        // Opções de fetch para lidar com CORS e outros problemas
        const fetchOptions = {
          method: 'GET',
          mode: 'cors', // Habilitar CORS
          cache: 'no-cache',
          headers: {
            'Accept': 'image/*', // Aceitar apenas imagens
            'Cache-Control': 'no-cache',
          },
        };

        const response = await fetch(absoluteUrl, fetchOptions);

        // Verificar se a resposta foi bem-sucedida
        if (!response.ok) {
          console.warn(`Erro ao buscar imagem. Status: ${response.status} - ${response.statusText}`);

          // Tentar método alternativo: usar proxy CORS
          return await fetchViaProxy(absoluteUrl, filename);
        }

        // Verificar tipo de conteúdo
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.startsWith('image/')) {
          console.warn('URL não é uma imagem válida:', absoluteUrl);
          return null;
        }

        const blob = await response.blob();

        // Gerar nome de arquivo baseado na URL ou parâmetro
        const suggestedFilename = filename || url.split('/').pop() || 'image.png';

        return new File([blob], suggestedFilename, { type: blob.type });
      } catch (fetchError) {
        console.warn('Erro no fetch direto:', fetchError);

        // Tentar método alternativo: usar proxy CORS
        return await fetchViaProxy(absoluteUrl, filename);
      }
    } catch (error) {
      console.error('Erro detalhado ao converter imagem:', {
        message: error.message,
        name: error.name,
        url: url,
        stack: error.stack,
      });

      // Último recurso: tentar criar um data URL a partir da imagem
      try {
        return await createDataUrlFromImage(url, filename);
      } catch (e) {
        console.error('Todas as tentativas de obter a imagem falharam');
        return null;
      }
    }
  }

  // Função auxiliar para buscar imagem via proxy CORS
  async function fetchViaProxy(url, filename) {
    try {
      // Usar um proxy CORS público
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
      console.log('Tentando via proxy CORS:', proxyUrl);

      const response = await fetch(proxyUrl);

      if (!response.ok) {
        throw new Error(`Proxy retornou status ${response.status}`);
      }

      const blob = await response.blob();
      return new File([blob], filename || 'proxy_image.png', { type: blob.type });
    } catch (error) {
      console.error('Erro ao usar proxy CORS:', error);
      return null;
    }
  }

  // Função auxiliar para criar data URL a partir de uma imagem
  async function createDataUrlFromImage(url, filename) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = function () {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);

          // Converter para data URL
          const dataUrl = canvas.toDataURL('image/png');

          // Converter para File
          fetch(dataUrl)
            .then(res => res.blob())
            .then(blob => {
              resolve(new File([blob], filename || 'canvas_image.png', { type: 'image/png' }));
            })
            .catch(reject);
        } catch (e) {
          reject(e);
        }
      };

      img.onerror = function () {
        reject(new Error('Não foi possível carregar a imagem'));
      };

      // Adicionar timestamp para evitar cache
      img.src = url.includes('?') ? `${url}&_t=${Date.now()}` : `${url}?_t=${Date.now()}`;
    });
  }

  // Adicionar eventos de drag and drop para imagens
  function initImageDragDrop() {
    const previewContainer = document.getElementById('kenAiImagePreviewContainer');
    const panel = document.getElementById('kenAiPanel');

    // Verificar se os elementos existem
    if (!panel || !previewContainer) {
      console.warn('Elementos necessários para drag and drop não encontrados');
      return;
    }

    // Criar overlay de drag
    const dragOverlay = document.createElement('div');
    dragOverlay.className = 'ken-ai-drag-overlay';
    dragOverlay.innerHTML = `
        <div class="ken-ai-drag-content">
            <i class="fas fa-image"></i>
            <p>Solte a imagem aqui</p>
        </div>
    `;
    dragOverlay.style.display = 'none';
    panel.appendChild(dragOverlay);

    // Função para verificar se o item arrastado é uma imagem
    function isImageDrag(event) {
      return (
        event.dataTransfer.types.includes('text/plain') ||
        event.dataTransfer.types.includes('text/uri-list') ||
        event.dataTransfer.types.includes('Files')
      );
    }

    panel.addEventListener('dragenter', (e) => {
      if (isImageDrag(e)) {
        e.preventDefault();
        dragOverlay.style.display = 'flex';
      }
    });

    panel.addEventListener('dragleave', (e) => {
      // Verificar se o mouse saiu do painel
      const rect = panel.getBoundingClientRect();
      if (
        e.clientX <= rect.left ||
        e.clientX >= rect.right ||
        e.clientY <= rect.top ||
        e.clientY >= rect.bottom
      ) {
        dragOverlay.style.display = 'none';
      }
    });

    panel.addEventListener('dragover', (e) => {
      if (isImageDrag(e)) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }
    });

    panel.addEventListener('drop', async (e) => {
      dragOverlay.style.display = 'none';

      if (!isImageDrag(e)) return;

      e.preventDefault();

      // Verificar limite de imagens
      const currentImageCount = uploadedFiles.filter((file) =>
        file.type.startsWith('image/')
      ).length;
      if (currentImageCount >= 3) {
        const previewContainer = document.getElementById('kenAiImagePreviewContainer');
        const limitMessage = document.createElement('div');
        limitMessage.className = 'ken-ai-image-limit-message';
        limitMessage.textContent = '🚫 Limite máximo de 3 imagens atingido';

        previewContainer.innerHTML = '';
        previewContainer.appendChild(limitMessage);
        previewContainer.style.display = 'flex';
        return;
      }

      // Tentar obter imagem de diferentes formas
      let imageFile = null;

      // Verificar se há arquivos arrastados
      if (e.dataTransfer.files.length > 0) {
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile.type.startsWith('image/')) {
          imageFile = droppedFile;
        }
      }

      // Se não for arquivo, tentar URL
      if (!imageFile) {
        const imageUrl =
          e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text/uri-list');

        if (imageUrl && (imageUrl.startsWith('http') || imageUrl.startsWith('data:image'))) {
          try {
            imageFile = await urlToFile(imageUrl);
          } catch (error) {
            console.error('Erro ao converter imagem arrastada:', error);
          }
        }
      }

      // Adicionar imagem se válida
      if (imageFile) {
        uploadedFiles.push(imageFile);
        updateImagePreviews();
      }
    });

    // Adicionar evento de dragstart para capturar imagens
    document.addEventListener('dragstart', (e) => {
      if (e.target.tagName === 'IMG') {
        e.dataTransfer.setData('text/plain', e.target.src);
      }
    });
  }

  // Função para capturar dados da página (screenshot + URL)
  async function capturePageData() {
    const url = window.location.href;

    // Fallback se html2canvas não estiver disponível
    if (!window.html2canvas) {
      console.warn('html2canvas não disponível, retornando apenas URL');
      return { url, screenshot: null };
    }

    try {
      // Capturar screenshot da página completa
      const canvas = await html2canvas(document.body, {
        useCORS: true,
        logging: false,
        allowTaint: false,
        scale: 0.5, // Reduzir escala para melhor performance
        windowWidth: Math.min(document.documentElement.scrollWidth, 1920),
        windowHeight: Math.min(document.documentElement.scrollHeight, 10000),
        scrollX: 0,
        scrollY: 0,
      });

      // Converter canvas para File
      return new Promise((resolve) => {
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const file = new File([blob], 'page_screenshot.png', {
                type: 'image/png',
              });
              resolve({ url, screenshot: file });
            } else {
              console.warn('Falha ao converter canvas para blob');
              resolve({ url, screenshot: null });
            }
          },
          'image/png',
          0.8
        );
      });
    } catch (error) {
      console.error('Erro ao capturar screenshot da página:', error);
      return { url, screenshot: null };
    }
  }

  // Adicionar estilo para o overlay de drag
  const dragStyles = `
    .ken-ai-drag-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(99, 102, 241, 0.7);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        backdrop-filter: blur(10px);
        transition: all 0.3s ease;
    }

    .ken-ai-drag-content {
        text-align: center;
        color: white;
        padding: 30px;
        border-radius: 20px;
        background: rgba(255, 255, 255, 0.1);
        border: 2px dashed rgba(255, 255, 255, 0.3);
    }

    .ken-ai-drag-content i {
        font-size: 50px;
        color: #ffd93d;
        margin-bottom: 15px;
        display: block;
    }

    .ken-ai-drag-content p {
        font-size: 16px;
        font-weight: 600;
    }
`;

  const dragStyleSheet = document.createElement('style');
  dragStyleSheet.textContent = dragStyles;
  document.head.appendChild(dragStyleSheet);

  // Drag and drop movido para setupEventListeners

  // Adicionar evento global para interceptar cliques em botões de acessibilidade
  document.addEventListener(
    'click',
    function (event) {
      // Log de depuração detalhado
      console.group('Evento de Clique no Botão de Acessibilidade');
      console.log('Alvo do evento:', event.target);
      console.log('Caminho do evento:', event.composedPath());

      // Verificar todos os botões de acessibilidade
      const accessibilityButtons = document.querySelectorAll(
        '.btn-rybena-vision, .btn-rybena-voice, .btn-rybena-sign-language'
      );
      console.log('Botões de acessibilidade encontrados:', accessibilityButtons);

      // Verificar se o clique foi em algum botão de acessibilidade
      let isAccessibilityButtonClicked = false;
      accessibilityButtons.forEach((button) => {
        if (event.target === button || event.target.closest('.' + button.className)) {
          isAccessibilityButtonClicked = true;
          console.log('Botão de acessibilidade clicado:', button);
        }
      });

      if (isAccessibilityButtonClicked) {
        // Prevenir comportamento padrão e propagação
        event.preventDefault();
        event.stopPropagation();

        // Desabilitar qualquer ação do site
        if (event.stopImmediatePropagation) {
          event.stopImmediatePropagation();
        }

        // Abrir/fechar painel do KEN AI
        const panel = document.getElementById('kenAiPanel');

        if (!panel) {
          console.error('Painel do KEN AI não encontrado!');
          return;
        }

        console.log('Estado atual do painel:', panel.classList.contains('open'));

        if (panel.classList.contains('open')) {
          panel.classList.remove('open');
          panel.style.right = '-500px';
          console.log('Fechando painel');
        } else {
          panel.classList.add('open');
          panel.style.right = '';
          console.log('Abrindo painel');

          // Focar no input
          setTimeout(() => {
            const input = document.getElementById('kenAiInput');
            if (input) {
              input.focus();
              console.log('Input focado');
            } else {
              console.error('Input não encontrado');
            }
          }, 400);
        }

        // Remover qualquer menu ou overlay do site
        try {
          const overlays = document.querySelectorAll(
            '[class*="overlay"], [class*="modal"], [class*="popup"]'
          );
          overlays.forEach((overlay) => {
            overlay.style.display = 'none';
            overlay.remove();
          });
        } catch (error) {
          console.warn('Erro ao remover overlays:', error);
        }
      }
    },
    true
  ); // Usar captura de evento para interceptar antes de outros manipuladores

  // Sistema de sugestões de comandos
  function createCommandSuggestions() {
    console.log('Iniciando createCommandSuggestions()');

    const input = document.getElementById('kenAiInput');
    const inputWrapper = document.querySelector('.ken-ai-input-wrapper');

    if (!input || !inputWrapper) {
      console.error('ERRO CRÍTICO: Elementos não encontrados para sugestões de comandos', {
        input: input,
        inputWrapper: inputWrapper,
      });
      return;
    }

    // Criar container de sugestões
    let suggestionsContainer = document.getElementById('kenAiCommandSuggestions');
    if (!suggestionsContainer) {
      suggestionsContainer = document.createElement('div');
      suggestionsContainer.id = 'kenAiCommandSuggestions';
    }

    suggestionsContainer.style.cssText = `
            position: absolute;
            bottom: 100%;
            left: 0;
            right: 0;
            background: white;
            border-radius: 8px;
            padding: 8px;
            display: none;
            max-height: 200px;
            overflow-y: auto;
            z-index: 1000;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            border: 1px solid #e0e0e0;
        `;

    // Mapa de comandos com atalhos e descrições
    const COMMANDS = {
      '/search-pag': {
        aliases: ['search', 'pag', 's', 'sp'],
        description: 'Analisa a página atual',
      },
      '/resumo': {
        aliases: ['resumo', 'r', 'sum'],
        description: 'Gera resumo de texto',
      },
      '/explicar': {
        aliases: ['explicar', 'e', 'exp'],
        description: 'Explica um conceito',
      },
      '/traduzir': {
        aliases: ['traduzir', 't', 'trans'],
        description: 'Traduz texto para outro idioma',
      },
      '/calcular': {
        aliases: ['calcular', 'c', 'calc'],
        description: 'Resolve cálculos matemáticos',
      },
    };

    // Função para renderizar sugestões
    function renderSuggestions(query) {
      console.log('Renderizando sugestões para query:', query);

      // Limpar sugestões anteriores
      suggestionsContainer.innerHTML = '';

      // Filtrar comandos que começam com a query
      const filteredCommands = Object.entries(COMMANDS).filter(
        ([fullCmd, cmdInfo]) =>
          fullCmd.toLowerCase().startsWith(query.toLowerCase()) ||
          cmdInfo.aliases.some((alias) =>
            ('/' + alias).toLowerCase().startsWith(query.toLowerCase())
          )
      );

      console.log('Comandos filtrados:', filteredCommands);

      // Renderizar comandos filtrados
      filteredCommands.forEach(([fullCmd, cmdInfo]) => {
        const cmdDiv = document.createElement('div');
        cmdDiv.style.cssText = `
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 10px;
                    cursor: pointer;
                    border-radius: 4px;
                    transition: background-color 0.2s ease;
                    margin-bottom: 4px;
                `;
        cmdDiv.innerHTML = `
                    <div style="display: flex; flex-direction: column;">
                        <strong style="color: #333; margin-bottom: 4px; font-size: 14px;">${fullCmd}</strong>
                        <span style="font-size: 12px; color: #666;">${cmdInfo.description}</span>
                    </div>
                    <span style="font-size: 12px; color: #999; margin-left: 10px;">${cmdInfo.aliases
            .map((a) => '/' + a)
            .join(', ')}</span>
                `;
        cmdDiv.addEventListener('click', () => {
          input.value = fullCmd + ' ';
          input.focus();
          suggestionsContainer.style.display = 'none';
        });
        cmdDiv.addEventListener('mouseover', () => {
          cmdDiv.style.backgroundColor = '#f5f5f5';
        });
        cmdDiv.addEventListener('mouseout', () => {
          cmdDiv.style.backgroundColor = 'transparent';
        });
        suggestionsContainer.appendChild(cmdDiv);
      });

      // Mostrar ou esconder container baseado em sugestões
      const shouldShow = filteredCommands.length > 0;
      suggestionsContainer.style.display = shouldShow ? 'block' : 'none';

      console.log('Sugestões visíveis:', shouldShow);
    }

    // Definir posicionamento do input wrapper
    inputWrapper.style.position = 'relative';

    // Remover container antigo se existir
    const oldContainer = inputWrapper.querySelector('#kenAiCommandSuggestions');
    if (oldContainer) {
      oldContainer.remove();
    }

    // Adicionar ao input wrapper
    inputWrapper.appendChild(suggestionsContainer);

    // Evento de input para mostrar sugestões
    input.addEventListener('input', (e) => {
      const value = e.target.value.trim();

      console.log('Valor do input:', value);

      // Mostrar sugestões apenas se começar com /
      if (value.startsWith('/')) {
        renderSuggestions(value);
      } else {
        suggestionsContainer.style.display = 'none';
      }
    });

    // Esconder ao perder foco
    input.addEventListener('blur', () => {
      setTimeout(() => {
        suggestionsContainer.style.display = 'none';
      }, 200);
    });

    console.log('Sugestões de comandos inicializadas com sucesso');
  }

  // Inicializar sugestões de comandos
  function setupCommandSuggestions() {
    console.log('Iniciando setupCommandSuggestions()');

    // Tentar inicializar imediatamente
    const input = document.getElementById('kenAiInput');
    const inputWrapper = document.querySelector('.ken-ai-input-wrapper');

    if (input && inputWrapper) {
      console.log('Elementos encontrados, inicializando sugestões');
      createCommandSuggestions();
      return;
    }

    // Configurar múltiplas tentativas
    let attempts = 0;
    const initInterval = setInterval(() => {
      const input = document.getElementById('kenAiInput');
      const inputWrapper = document.querySelector('.ken-ai-input-wrapper');

      console.log('Tentativa de inicializar sugestões:', {
        input: !!input,
        inputWrapper: !!inputWrapper,
        attempts: attempts,
      });

      if (input && inputWrapper) {
        createCommandSuggestions();
        clearInterval(initInterval);
      }

      attempts++;
      if (attempts >= 10) {
        console.error('KEN AI: Falha ao inicializar sugestões de comandos');
        clearInterval(initInterval);
      }
    }, 500);
  }

  // Event listeners removidos - agora chamados dentro de setupEventListeners

  // Função para atualizar placeholder do input
  function updateInputPlaceholder() {
    const input = document.getElementById('kenAiInput');

    if (!input) return;

    // Adicionar evento de input para atualizar placeholder
    input.addEventListener('input', function () {
      if (this.value.trim().length > 0) {
        this.setAttribute('placeholder', '');
      } else {
        this.setAttribute('placeholder', '  Digite sua dúvida...');
      }
    });

    // Adicionar evento de blur para restaurar placeholder se estiver vazio
    input.addEventListener('blur', function () {
      if (this.value.trim().length === 0) {
        this.setAttribute('placeholder', '  Digite sua dúvida...');
      }
    });
  }

  // Inicializar atualização de placeholder
  function setupPlaceholderUpdate() {
    let attempts = 0;
    const initInterval = setInterval(() => {
      const input = document.getElementById('kenAiInput');

      if (input) {
        updateInputPlaceholder();
        clearInterval(initInterval);
      }

      attempts++;
      if (attempts >= 10) {
        console.error('KEN AI: Falha ao inicializar atualização de placeholder');
        clearInterval(initInterval);
      }
    }, 500);
  }

  // Event listeners removidos - agora chamados dentro de setupEventListeners

  // Função global para abrir Mini KEN Chat com debug automático
  window.openMiniKenWithDebug = function () {
    // Verificar se já existe um Mini KEN Chat aberto
    const existingMiniChat = document.getElementById('kenMiniChat');
    if (existingMiniChat) {
      existingMiniChat.remove();
    }

    // Obter seleção atual
    const selection = window.getSelection();
    const selectedText = selection.toString();

    // Criar Mini KEN Chat
    createMiniKenChat(selectedText);

    // Forçar captura de imagens
    setTimeout(() => {
      forceImageCapture();
      console.log('Debug automático: captura de imagens forçada');

      // Adicionar mensagem de debug
      const messagesContainer = document.getElementById('miniChatMessages');
      if (messagesContainer) {
        const debugMessage = document.createElement('div');
        debugMessage.innerHTML = `
          <div style="
            margin: 10px 0;
            padding: 8px;
            background: rgba(255, 217, 61, 0.2);
            border-radius: 8px;
            font-size: 11px;
            color: #ffd93d;
            text-align: center;
          ">
            <i class="fas fa-bug"></i> Modo debug ativado. 
            Captura de imagens aprimorada.
            <div style="margin-top: 5px; font-size: 9px;">
              Imagens encontradas: ${window.miniChatSelectedImages ? window.miniChatSelectedImages.length : 0}
            </div>
          </div>
        `;
        messagesContainer.appendChild(debugMessage);
      }
    }, 500);
  };



  // Função para adicionar botão de análise de página
  function addPageAnalysisButton() {
    const panel = document.getElementById('kenAiPanel');
    if (!panel) {
      console.error('Painel KEN AI não encontrado');
      return;
    }

    // Verificar se o botão já existe
    if (document.getElementById('kenPageAnalysisBtn')) {
      return;
    }


  }

  // Chamar função para adicionar botão de análise de página após inicialização
  setTimeout(addPageAnalysisButton, 2000);

  // Função para capturar contexto avançado da seleção
  async function captureSelectionContext() {
    try {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return null;

      const range = selection.getRangeAt(0);
      const selectedText = selection.toString().trim();
      if (!selectedText) return null;

      // Capturar informações básicas da seleção
      const rect = range.getBoundingClientRect();
      const container = range.commonAncestorContainer;

      // Capturar contexto expandido (elementos pai)
      let parentContext = '';
      let parentElement = container.nodeType === 3 ? container.parentElement : container;

      // Obter título da seção ou cabeçalho mais próximo
      let closestHeading = null;
      let currentNode = parentElement;

      // Procurar pelo cabeçalho mais próximo acima do elemento selecionado
      while (currentNode && !closestHeading) {
        // Verificar se é um cabeçalho
        if (/^H[1-6]$/.test(currentNode.tagName)) {
          closestHeading = currentNode;
        } else {
          // Verificar irmãos anteriores
          let sibling = currentNode.previousElementSibling;
          while (sibling && !closestHeading) {
            if (/^H[1-6]$/.test(sibling.tagName)) {
              closestHeading = sibling;
            }
            sibling = sibling.previousElementSibling;
          }

          // Se não encontrou, subir para o pai
          currentNode = currentNode.parentElement;
        }
      }

      // Adicionar título da seção ao contexto
      if (closestHeading) {
        parentContext += `TÍTULO DA SEÇÃO: ${closestHeading.textContent.trim()}\n\n`;
      }

      // Capturar URL da página
      const pageUrl = window.location.href;
      const pageTitle = document.title;

      // Capturar metadados da página
      const metaDescription = document.querySelector('meta[name="description"]')?.content || '';
      const metaKeywords = document.querySelector('meta[name="keywords"]')?.content || '';

      // Capturar contexto circundante (texto ao redor da seleção)
      let surroundingText = '';
      try {
        // Tentar obter o parágrafo ou elemento pai que contém a seleção
        let containerElement = parentElement;
        while (containerElement &&
          !['P', 'DIV', 'SECTION', 'ARTICLE', 'LI', 'TD', 'BLOCKQUOTE'].includes(containerElement.tagName)) {
          containerElement = containerElement.parentElement;
        }

        if (containerElement) {
          // Obter texto do elemento pai (limitado a 500 caracteres)
          const fullText = containerElement.textContent;
          if (fullText && fullText.length > selectedText.length) {
            surroundingText = `CONTEXTO CIRCUNDANTE:\n"${fullText.substring(0, 500)}${fullText.length > 500 ? '...' : ''}"\n\n`;
          }
        }
      } catch (e) {
        console.error('Erro ao capturar contexto circundante:', e);
      }

      // Construir objeto de contexto
      const context = {
        selectedText,
        pageTitle,
        pageUrl,
        metaDescription,
        metaKeywords,
        parentContext,
        surroundingText,
        timestamp: new Date().toISOString(),
        selectionRect: {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height
        }
      };

      console.log('Contexto capturado:', context);
      return context;
    } catch (error) {
      console.error('Erro ao capturar contexto da seleção:', error);
      return null;
    }
  }

  // Função para melhorar o prompt com o contexto da seleção
  function enhancePromptWithContext(message, context) {
    if (!context) return message;

    let enhancedPrompt = '';

    // Adicionar informações do contexto
    if (context.pageTitle) {
      enhancedPrompt += `PÁGINA: ${context.pageTitle}\n`;
    }

    if (context.pageUrl) {
      enhancedPrompt += `URL: ${context.pageUrl}\n`;
    }

    if (context.parentContext) {
      enhancedPrompt += context.parentContext;
    }

    // Adicionar texto selecionado
    enhancedPrompt += `CONTEÚDO SELECIONADO:\n"${context.selectedText}"\n\n`;

    // Adicionar contexto circundante se disponível
    if (context.surroundingText) {
      enhancedPrompt += context.surroundingText;
    }

    // Adicionar metadados se disponíveis
    if (context.metaDescription) {
      enhancedPrompt += `DESCRIÇÃO DA PÁGINA: ${context.metaDescription}\n\n`;
    }

    // Adicionar a pergunta do usuário
    enhancedPrompt += `PERGUNTA DO USUÁRIO: ${message}`;

    return enhancedPrompt;
  }

  // Função para abrir o mini KEN com contexto aprimorado
  async function openMiniKenWithContext(selectedText) {
    let context = await captureSelectionContext();

    // Se não conseguiu capturar contexto da seleção, tenta capturar contexto da página
    if (!context && (!selectedText || selectedText.trim() === '')) {
      context = await capturePageContext();
      selectedText = 'Análise da página atual';
    }

    window.miniKenContext = context; // Armazenar contexto para uso posterior

    // Mostrar feedback ao usuário
    if (context) {
      showFeedback('Mini KEN Chat aberto com contexto aprimorado', 'success');
    }

    // Abrir o mini chat com o texto selecionado ou mensagem padrão
    openMiniKenChat(selectedText || 'Como posso ajudar?');
  }

  // Expor função globalmente
  window.openMiniKenWithContext = openMiniKenWithContext;

  // Função para capturar contexto da página quando não há seleção
  async function capturePageContext() {
    try {
      // Capturar URL e título da página
      const pageUrl = window.location.href;
      const pageTitle = document.title;

      // Capturar metadados da página
      const metaDescription = document.querySelector('meta[name="description"]')?.content || '';
      const metaKeywords = document.querySelector('meta[name="keywords"]')?.content || '';

      // Capturar cabeçalhos principais
      const mainHeadings = Array.from(document.querySelectorAll('h1, h2')).map(h => h.textContent.trim()).join(' | ');

      // Tentar capturar o conteúdo principal da página
      let mainContent = '';

      // Tentar encontrar o conteúdo principal usando seletores comuns
      const mainSelectors = [
        'main',
        'article',
        '#content',
        '.content',
        '.main-content',
        '[role="main"]'
      ];

      let mainElement = null;
      for (const selector of mainSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          mainElement = element;
          break;
        }
      }

      // Se encontrou um elemento principal, extrair seu texto
      if (mainElement) {
        mainContent = mainElement.textContent.trim().substring(0, 1000);
      } else {
        // Fallback: usar o body inteiro, mas limitado
        mainContent = document.body.textContent.trim().substring(0, 1000);
      }

      // Construir objeto de contexto
      const context = {
        selectedText: 'Página inteira: ' + pageTitle,
        pageTitle,
        pageUrl,
        metaDescription,
        metaKeywords,
        parentContext: `TÍTULO PRINCIPAL: ${mainHeadings || pageTitle}\n\n`,
        surroundingText: `CONTEÚDO DA PÁGINA:\n"${mainContent}${mainContent.length >= 1000 ? '...' : ''}"\n\n`,
        timestamp: new Date().toISOString()
      };

      console.log('Contexto da página capturado:', context);
      return context;
    } catch (error) {
      console.error('Erro ao capturar contexto da página:', error);
      return null;
    }
  }

  // ===== NOVO SISTEMA DE GERENCIAMENTO DE CONVERSAS =====

  // Estrutura de dados limpa e simples
  const ChatManager = {
    conversations: new Map(), // Usar Map para melhor performance
    currentChatId: null,
    chatCounter: 1,
    isLoadingChat: false, // Flag para evitar salvamento durante carregamento

    // Gerar ID único e simples
    generateId() {
      return `chat_${Date.now()}_${this.chatCounter++}`;
    },

    // Criar nova conversa
    createChat() {
      const id = this.generateId();
      const chat = {
        id: id,
        messages: [],
        createdAt: new Date(),
        title: 'Nova Conversa',
        lastActivity: new Date()
      };

      this.conversations.set(id, chat);
      this.currentChatId = id;

      console.log('Nova conversa criada:', id);
      this.updatePanel();
      return id;
    },

    // Salvar mensagem na conversa atual
    saveMessage(role, content) {
      // Não salvar se estiver carregando conversa (evitar duplicação)
      if (this.isLoadingChat) return;

      if (!this.currentChatId) {
        this.createChat();
      }

      const chat = this.conversations.get(this.currentChatId);
      if (chat) {
        // Verificar se a mensagem já existe (evitar duplicatas)
        const lastMessage = chat.messages[chat.messages.length - 1];
        if (lastMessage && lastMessage.content === content && lastMessage.role === role) {
          console.log('Mensagem duplicada ignorada:', content.substring(0, 50));
          return;
        }

        chat.messages.push({
          role: role,
          content: content,
          timestamp: new Date()
        });

        // Atualizar título baseado na primeira mensagem do usuário
        if (role === 'user' && chat.messages.filter(m => m.role === 'user').length === 1) {
          chat.title = content.substring(0, 30) + (content.length > 30 ? '...' : '');
        }

        chat.lastActivity = new Date();
        this.updatePanel();
      }
    },

    // Carregar conversa
    loadChat(chatId) {
      if (this.currentChatId === chatId) return;

      const chat = this.conversations.get(chatId);
      if (!chat) {
        console.error('Conversa não encontrada:', chatId);
        return;
      }

      // Definir flag para evitar salvamento durante carregamento
      this.isLoadingChat = true;
      this.currentChatId = chatId;

      // Limpar interface atual
      this.clearChatInterface();

      // Atualizar chatHistory para compatibilidade
      if (window.chatHistory) {
        window.chatHistory = chat.messages.map(msg => ({
          role: msg.role,
          parts: [{ text: msg.content }]
        }));
      }

      // Carregar mensagens diretamente na interface (sem usar addMessage para evitar duplicação)
      const chatContainer = document.getElementById('kenAiChat');
      if (chatContainer) {
        chat.messages.forEach(msg => {
          const messageDiv = document.createElement('div');
          messageDiv.className = `ken-ai-message ${msg.role === 'user' ? 'user' : 'ai'}`;

          const bubbleDiv = document.createElement('div');
          bubbleDiv.className = 'ken-ai-bubble';

          if (msg.role === 'user') {
            bubbleDiv.textContent = msg.content;
          } else {
            // Para mensagens da IA, processar markdown
            if (typeof window.processMarkdown === 'function') {
              bubbleDiv.innerHTML = `<div class="markdown-content">${window.processMarkdown(msg.content)}</div>`;
            } else {
              bubbleDiv.textContent = msg.content;
            }
          }

          messageDiv.appendChild(bubbleDiv);
          chatContainer.appendChild(messageDiv);
        });

        chatContainer.scrollTop = chatContainer.scrollHeight;
      }

      // Resetar flag após carregamento
      setTimeout(() => {
        this.isLoadingChat = false;
      }, 100);

      console.log('Conversa carregada:', chatId);
      this.updatePanel();
    },

    // Excluir conversa
    deleteChat(chatId) {
      if (this.conversations.has(chatId)) {
        this.conversations.delete(chatId);

        // Se era a conversa atual, resetar
        if (this.currentChatId === chatId) {
          this.currentChatId = null;
          this.clearChatInterface();
        }

        this.updatePanel();
        console.log('Conversa excluída:', chatId);
      }
    },

    // Limpar interface do chat
    clearChatInterface() {
      // Limpar chatHistory global para compatibilidade
      if (window.chatHistory) {
        window.chatHistory = [];
      }

      const chatContainer = document.getElementById('kenAiChat');
      if (chatContainer) {
        const messages = chatContainer.querySelectorAll('.ken-ai-message');
        messages.forEach(msg => msg.remove());

        // Mostrar mensagem de boas-vindas
        const welcomeMessage = chatContainer.querySelector('.ken-ai-welcome');
        const commandsMenu = chatContainer.querySelector('.ken-ai-commands-menu');

        if (welcomeMessage) welcomeMessage.style.display = 'block';
        if (commandsMenu) commandsMenu.style.display = 'block';
      }
    },

    // Atualizar painel de histórico
    updatePanel() {
      const historyStats = document.getElementById('kenAiHistoryStats');
      const conversationsList = document.getElementById('kenAiConversationsList');

      if (!historyStats || !conversationsList) return;

      // Calcular total de mensagens
      let totalMessages = 0;
      this.conversations.forEach(chat => {
        totalMessages += chat.messages.length;
      });

      historyStats.textContent = `${totalMessages} mensagens`;

      // Limpar lista
      conversationsList.innerHTML = '';

      // Mostrar conversas (mais recentes primeiro)
      const sortedChats = Array.from(this.conversations.values())
        .sort((a, b) => b.lastActivity - a.lastActivity)
        .slice(0, 10); // Mostrar apenas as 10 mais recentes

      if (sortedChats.length === 0) {
        conversationsList.innerHTML = `
          <div style="text-align: center; color: rgba(255, 255, 255, 0.6); font-size: 11px; padding: 20px;">
            <i class="fas fa-comments"></i><br>
            Nenhuma conversa ainda.<br>
            Comece uma nova conversa!
          </div>
        `;
        return;
      }

      sortedChats.forEach(chat => {
        const item = this.createChatItem(chat);
        conversationsList.appendChild(item);
      });
    },

    // Criar item de conversa no painel
    createChatItem(chat) {
      const item = document.createElement('div');
      item.className = 'ken-ai-conversation-item';
      if (chat.id === this.currentChatId) {
        item.classList.add('active');
      }

      const messageCount = chat.messages.length;
      const lastActivity = chat.lastActivity.toLocaleDateString('pt-BR');

      item.innerHTML = `
        <div class="ken-ai-conversation-header">
          <div class="ken-ai-conversation-date">${lastActivity}</div>
          <div class="ken-ai-conversation-count">${messageCount} msgs</div>
        </div>
        <div class="ken-ai-conversation-preview">${chat.title}</div>
        <div class="ken-ai-conversation-actions">
          <button class="ken-ai-history-action-btn delete" onclick="event.stopPropagation(); window.ChatManager.deleteChat('${chat.id}');">
            <i class="fas fa-trash"></i> Excluir
          </button>
        </div>
      `;

      // Evento de clique para carregar conversa
      item.addEventListener('click', (e) => {
        if (e.target.closest('.delete')) return;
        this.loadChat(chat.id);
      });

      return item;
    }
  };

  // Expor ChatManager globalmente
  window.ChatManager = ChatManager;

  // Inicializar o painel na primeira execução
  setTimeout(() => {
    ChatManager.updatePanel();
  }, 1000);

  // Usar o novo sistema de gerenciamento
  function updateHistoryPanel() {
    ChatManager.updatePanel();
  }



  // Nova função para iniciar conversa
  window.startNewChat = function () {
    console.log('Iniciando nova conversa...');

    // Salvar conversa atual se houver mensagens
    if (chatHistory.length > 0) {
      ChatManager.saveMessage('user', chatHistory[0]?.parts[0]?.text || '');
      if (chatHistory.length > 1) {
        ChatManager.saveMessage('model', chatHistory[1]?.parts[0]?.text || '');
      }
    }

    // Criar nova conversa
    ChatManager.createChat();

    // Limpar interface
    ChatManager.clearChatInterface();

    showAiStatus('Nova conversa iniciada!');
  };

  // Função antiga removida - usando novo sistema

  // Sistema antigo completamente removido - usando apenas ChatManager

  // Nova função limpa para iniciar conversa
  window.startNewChat = function () {
    console.log('Iniciando nova conversa...');

    // Salvar conversa atual se houver mensagens
    if (chatHistory.length > 0) {
      // Salvar todas as mensagens da conversa atual
      chatHistory.forEach(msg => {
        if (msg.parts && msg.parts[0] && msg.parts[0].text) {
          ChatManager.saveMessage(msg.role, msg.parts[0].text);
        }
      });
    }

    // Criar nova conversa
    ChatManager.createChat();

    // Limpar interface
    ChatManager.clearChatInterface();

    showAiStatus('Nova conversa iniciada!');
  };





  // Função antiga removida - usando ChatManager.deleteChat()

  // Expor funções globalmente para uso por outros scripts
  window.kenAI = window.kenAI || {};
  window.kenAI.captureSelectionContext = captureSelectionContext;
  window.kenAI.capturePageContext = capturePageContext;
  window.kenAI.openMiniKenWithContext = openMiniKenWithContext;
  window.kenAI.enhancePromptWithContext = enhancePromptWithContext;
  window.kenAI.updateHistoryPanel = updateHistoryPanel;

  // Função para uso por outros desenvolvedores
  window.openKenChatWithSelection = async function () {
    const selection = window.getSelection();
    const selectedText = selection ? selection.toString().trim() : '';

    if (selectedText) {
      await openMiniKenWithContext(selectedText);
      return true;
    } else {
      // Se não houver seleção, tenta capturar contexto da página
      const context = await capturePageContext();
      if (context) {
        window.miniKenContext = context;
        openMiniKenChat('Analise esta página');
        return true;
      }
    }

    return false;
  };
})();
