(async function () {
  'use strict';

  let bookmarksBar;
  let reloadButton;
  let stylesInjected = false;

  // Initialize the interface
  async function initializeInterface() {
    waitForEach('[aria-label=Bookmarks] > .observer', async element => {
      bookmarksBar = element;
      await renderBookmarks();
      ensureReloadButton();
    });
    addStyles();
  }

  // Central MutationObserver manager
  const CentralObserverManager = (function () {
    // Private properties
    let mainObserver = null;
    const callbacks = new Map(); // Maps selectors to arrays of callback functions
    const processedElements = new Map(); // Maps selectors to Sets of processed elements

    // Process mutations for all registered callbacks
    function processMutations(mutations) {
      // Check for added nodes
      mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
          // Process added nodes
          mutation.addedNodes.forEach(node => {
            if (node.nodeType !== Node.ELEMENT_NODE) return;

            // Check this node against all registered selectors
            callbacks.forEach((callbackArray, selector) => {
              // Check if the node itself matches
              if (node.matches(selector)) {
                executeCallbacks(node, selector, callbackArray);
              }

              // Check if any of its children match
              if (node.querySelector(selector)) {
                node.querySelectorAll(selector).forEach(element => {
                  executeCallbacks(element, selector, callbackArray);
                });
              }
            });
          });

          // Handle removed nodes (if needed)
          mutation.removedNodes.forEach(node => {
            if (node.nodeType !== Node.ELEMENT_NODE) return;
            // Implementation for tracking removed nodes if needed
          });
        }
      });

      // Also check for all newly added elements that might match existing selectors
      // (this ensures we don't miss elements added through innerHTML or other means)
      callbacks.forEach((callbackArray, selector) => {
        document.querySelectorAll(selector).forEach(element => {
          executeCallbacks(element, selector, callbackArray);
        });
      });
    }

    // Execute callbacks for a matched element
    function executeCallbacks(element, selector, callbackArray) {
      // Get or create the Set of processed elements for this selector
      let processed = processedElements.get(selector);
      if (!processed) {
        processed = new Set();
        processedElements.set(selector, processed);
      }

      // Skip if already processed
      if (processed.has(element)) return;

      // Mark as processed and execute callbacks
      processed.add(element);
      callbackArray.forEach(callback => callback(element));
    }

    // Initialize the main observer
    function initializeObserver() {
      if (mainObserver) return; // Already initialized

      mainObserver = new MutationObserver(processMutations);
      mainObserver.observe(document.body, {
        childList: true,
        subtree: true,
      });

      // Process existing elements on page
      callbacks.forEach((callbackArray, selector) => {
        document.querySelectorAll(selector).forEach(element => {
          executeCallbacks(element, selector, callbackArray);
        });
      });
    }

    return {
      // Register a callback for a specific selector
      observe: function (selector, callback, processExisting = true) {
        // Create or retrieve callback array for this selector
        if (!callbacks.has(selector)) {
          callbacks.set(selector, []);
          processedElements.set(selector, new Set());
        }

        callbacks.get(selector).push(callback);

        // Initialize observer if not already done
        initializeObserver();

        // Process existing elements if requested
        if (processExisting) {
          document.querySelectorAll(selector).forEach(element => {
            executeCallbacks(element, selector, callbacks.get(selector));
          });
        }

        // Return a function to remove this specific callback
        return function unobserve() {
          const callbackArray = callbacks.get(selector);
          if (callbackArray) {
            const index = callbackArray.indexOf(callback);
            if (index !== -1) {
              callbackArray.splice(index, 1);
            }

            // Remove the selector entry if no callbacks remain
            if (callbackArray.length === 0) {
              callbacks.delete(selector);
              processedElements.delete(selector);
            }
          }
        };
      },

      // Reset tracking for a specific selector
      resetSelector: function (selector) {
        if (processedElements.has(selector)) {
          processedElements.get(selector).clear();
        }
      },

      // Disconnect and clean up everything
      disconnect: function () {
        if (mainObserver) {
          mainObserver.disconnect();
          mainObserver = null;
        }
        callbacks.clear();
        processedElements.clear();
      },
    };
  })();

  function waitForEach(selector, callback, options = {}) {
    const { once = false } = options;

    // Register with observer manager
    const unobserve = CentralObserverManager.observe(selector, callback);

    // If once is true, unobserve after processing existing elements
    if (once) {
      setTimeout(unobserve, 0);
    }

    return {
      unobserve,
      reload: () => {
        CentralObserverManager.resetSelector(selector);
      },
    };
  }

  // New function to clear and reload bookmarks
  async function reloadBookmarks() {
    // Clear existing bookmarks
    if (!bookmarksBar) return;

    bookmarksBar.querySelectorAll('.vbm-folder-wrap').forEach(folder => {
      folder.remove();
    });
    // Re-render bookmarks
    await renderBookmarks();
  }

  // Separated bookmark rendering logic
  function renderBookmarks() {
    return new Promise(resolve => {
      chrome.bookmarks.getTree(bookmarkTreeNodes => {
        const bookmarkBarFolder = bookmarkTreeNodes[0].children[0].children[0];

        if (bookmarkBarFolder && bookmarkBarFolder.children) {
          bookmarkBarFolder.children.forEach(bookmarkNode => {
            if (bookmarkNode.children) {
              // It's a folder
              const folderElement = createFolderElement(bookmarkNode);
              bookmarksBar.prepend(folderElement);
            }
          });
        }
        resolve();
      });
    });
  }

  // Add reload button
  function ensureReloadButton() {
    if (!bookmarksBar || reloadButton) return;

    reloadButton = document.createElement('div');
    reloadButton.classList.add('vbm-reload-button');
    reloadButton.innerHTML = '↻';
    reloadButton.title = 'Reload Bookmarks';
    reloadButton.addEventListener('click', reloadBookmarks);
    bookmarksBar.parentElement.insertBefore(reloadButton, bookmarksBar);
  }

  // Function to create a folder element
  function createFolderElement(folder) {
    const folderWrapper = document.createElement('div');
    folderWrapper.classList.add('vbm-folder-wrap');

    const folderElement = document.createElement('button');
    folderElement.type = 'button';
    folderElement.classList.add('vbm-custom-folder');

    // Create folder title/image container
    const folderTitleContainer = document.createElement('div');
    folderTitleContainer.classList.add('vbm-folder-title-container');

    // create image element
    if (folder.description) {
      const folderImage = document.createElement('img');
      folderImage.classList.add('vbm-folder-image');
      folderImage.src = `https://www.google.com/s2/favicons?sz=32&domain=${folder.description}`;
      folderImage.alt = folder.description;
      folderTitleContainer.appendChild(folderImage);
    }
    // create text element
    else {
      const folderName = document.createElement('span');
      folderName.textContent = folder.title;
      folderName.classList.add('vbm-folder-name');
      folderTitleContainer.appendChild(folderName);
    }

    folderElement.appendChild(folderTitleContainer);

    const expandedContent = document.createElement('div');
    expandedContent.classList.add('vbm-expanded-content');

    folder.children.forEach(child => {
      const itemElement = document.createElement('div');
      itemElement.classList.add('vbm-folder-item');

      if (child.url) {
        // It's a bookmark
        const link = document.createElement('a');
        link.href = child.url;
        link.classList.add('vbm-bookmark-link');
        itemElement.title = `${child.title}`;

        const faviconSrc = `https://www.google.com/s2/favicons?sz=32&domain=${child.url}`;
        const faviconEl = generateElements(
          `<img src='${faviconSrc}' class='vbm-favicon'>`,
          link,
        );

        itemElement.appendChild(link);

        link.addEventListener('click', () => {
          const activeTabEl = document.querySelector(
            '.active [role=document][src]',
          );
          activeTabEl.src = child.url;
        });
      } else {
        // It's a subfolder
        itemElement.innerHTML = `<span class="vbm-subfolder-icon">📁</span>`;
        itemElement.classList.add('vbm-subfolder');
        itemElement.title = child.title || 'Unnamed Folder';
      }

      expandedContent.appendChild(itemElement);
    });

    folderWrapper.appendChild(folderElement);
    folderWrapper.appendChild(expandedContent);

    // Add event listeners for hover
    folderWrapper.addEventListener('mouseenter', () => {
      folderWrapper.classList.add('vbm-expanded');
    });

    folderWrapper.addEventListener('mouseleave', () => {
      folderWrapper.classList.remove('vbm-expanded');
    });

    return folderWrapper;
  }

  // Function to add styles to the document
  function addStyles() {
    if (stylesInjected) return;

    const styles = `
        .bookmark-bar .vbm-folder-wrap {
          position: relative;
            }

        .bookmark-bar .vbm-custom-folder {
                position: relative;
                cursor: pointer;
                padding: 5px;
                margin-right: 1px;
                border-radius: 4px;
          border: 0;
          background: transparent;
          color: inherit;
          font: inherit;
                transition: all 0.3s ease;
            }

        .bookmark-bar .vbm-reload-button {
                cursor: pointer;
                padding: 5px 8px;
                margin-right: 5px;
                border-radius: 4px;
                background-color: rgba(255, 255, 255, 0.1);
                color: #ffffff;
                font-size: 16px;
                transition: all 0.3s ease;
                display: flex;
                align-items: center;
                justify-content: center;
            }

              .bookmark-bar .vbm-reload-button:hover {
                background-color: rgba(255, 255, 255, 0.2);
                transform: rotate(180deg);
            }

              .bookmark-bar .vbm-custom-folder:hover {
                background-color: rgba(255, 255, 255, 0.1);
            }

              .bookmark-bar .vbm-folder-title-container {
                display: flex;
                align-items: center;
                height: 16px;
            }

              .bookmark-bar .vbm-folder-name {
                position: relative;
                z-index: 2;
            }

              .bookmark-bar .vbm-folder-image {
                width: 16px;
                height: 16px;
                object-fit: contain;
            }

              .bookmark-bar .vbm-expanded-content {
                position: absolute;
                top: 100%;
                left: 0;
                background-color: #2f3136;
                border: 1px solid #40444b;
                border-radius: 4px;
                padding: 10px;
                z-index: 1000;
                opacity: 0;
                transform: translateY(-10px);
                transition: all 0.3s ease;
                pointer-events: none;
                box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(40px, 1fr));
                gap: 10px;
                max-width: 300px;
                max-height: 400px;
                overflow-y: auto;
            }

              .bookmark-bar .vbm-folder-wrap.vbm-expanded .vbm-expanded-content {
                opacity: 1;
                transform: translateY(0);
                pointer-events: auto;
            }

              .bookmark-bar .vbm-folder-item {
                width: 32px;
                height: 32px;
                transition: all 0.2s ease;
                border-radius: 4px;
                display: flex;
                justify-content: center;
                align-items: center;
            }

              .bookmark-bar .vbm-folder-item:hover {
                background-color: rgba(255, 255, 255, 0.1);
                transform: scale(1.1);
            }

              .bookmark-bar .vbm-bookmark-link {
                display: flex;
                align-items: center;
                justify-content: center;
                text-decoration: none;
                color: #ffffff;
                width: 100%;
                height: 100%;
            }

              .bookmark-bar .vbm-favicon {
                width: 32px;
                height: 32px;
            }

              .bookmark-bar .vbm-subfolder {
                font-size: 24px;
                color: #ffffff;
            }

              .bookmark-bar .vbm-folder-item::after {
                content: attr(title);
                position: absolute;
                bottom: 0%;
                left: 50%;
                transform: translateX(-50%);
                background-color: rgba(0, 0, 0, 0.8);
                color: #ffffff;
                padding: 5px;
                border-radius: 4px;
                font-size: 12px;
                white-space: nowrap;
                opacity: 0;
                transition: opacity 0.2s ease;
                pointer-events: none;
            }

              .bookmark-bar .vbm-folder-item:hover::after {
                opacity: 1;
            }
        `;

    const styleElement = document.createElement('style');
    styleElement.textContent = styles;
    document.head.appendChild(styleElement);
          stylesInjected = true;
  }

  function waitForAll(selector) {
    return new Promise(resolve => {
      if (document.querySelector(selector)) {
        return resolve(document.querySelectorAll(selector));
      }

      const observer = new MutationObserver(() => {
        if (document.querySelector(selector)) {
          resolve(document.querySelectorAll(selector));
          observer.disconnect();
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });
    });
  }

  function waitFor(selector) {
    return new Promise(resolve => {
      waitForAll(selector).then(els => {
        resolve(els[0]);
      });
    });
  }

  function generateDoc(html) {
    let escapeHTMLPolicy = trustedTypes.createPolicy('forceInner', {
      createHTML: to_escape => to_escape,
    });

    const template = document.createElement('template');
    document.body.prepend(template);

    template.innerHTML = escapeHTMLPolicy.createHTML(html.trim());

    const templateContent = template.content;
    template.remove();
    return templateContent;
  }

  function generateElements(html, parent, returnTrusted) {
    const doc = generateDoc(html, returnTrusted);
    const children = doc.children;
    let returnChildren = [...children];
    if (parent) {
      returnChildren.length = 0;
      for (const child of children) {
        returnChildren.push(parent.appendChild(child));
      }
    }
    return returnChildren.length === 1 ? returnChildren[0] : returnChildren;
  }

  // Initialize the interface and add reload button
  await initializeInterface();
})();
