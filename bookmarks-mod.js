( async function () {
  'use strict';

  let bookmarksBar;

  // Initialize the interface
  async function initializeInterface () {
    bookmarksBar = await waitFor( '[aria-label=Bookmarks] > .observer' );
    addStyles();
    await renderBookmarks();
  }

  // New function to clear and reload bookmarks
  async function reloadBookmarks () {
    // Clear existing bookmarks
    bookmarksBar.querySelectorAll( '.custom-folder' ).forEach( folder => {
      folder.remove();
    } );
    // Re-render bookmarks
    await renderBookmarks();
  }

  // Separated bookmark rendering logic
  function renderBookmarks () {
    return new Promise( ( resolve ) => {
      chrome.bookmarks.getTree( ( bookmarkTreeNodes ) => {
        const bookmarkBarFolder = bookmarkTreeNodes[ 0 ].children[ 0 ].children[ 0 ];

        if ( bookmarkBarFolder && bookmarkBarFolder.children ) {
          bookmarkBarFolder.children.forEach( bookmarkNode => {
            if ( bookmarkNode.children ) { // It's a folder
              const folderElement = createFolderElement( bookmarkNode );
              bookmarksBar.prepend( folderElement );
            }
          } );
        }
        resolve();
      } );
    } );
  }

  // Add reload button
  function addReloadButton () {
    const reloadButton = document.createElement( 'div' );
    reloadButton.classList.add( 'reload-button' );
    reloadButton.innerHTML = '↻';
    reloadButton.title = 'Reload Bookmarks';
    reloadButton.addEventListener( 'click', reloadBookmarks );
    bookmarksBar.parentElement.insertBefore( reloadButton, bookmarksBar );
  }

  // Function to create a folder element
  function createFolderElement ( folder ) {
    const folderElement = document.createElement( 'div' );
    folderElement.classList.add( 'custom-folder' );

    // Create folder title/image container
    const folderTitleContainer = document.createElement( 'div' );
    folderTitleContainer.classList.add( 'folder-title-container' );

    // create image element
    if ( folder.description ) {
      const folderImage = document.createElement( 'img' );
      folderImage.classList.add( 'folder-image' );
      folderImage.src = `https://www.google.com/s2/favicons?sz=32&domain=${ folder.description }`;
      folderImage.alt = folder.description;
      folderTitleContainer.appendChild( folderImage );
    }
    // create text element
    else {
      const folderName = document.createElement( 'span' );
      folderName.textContent = folder.title;
      folderName.classList.add( 'folder-name' );
      folderTitleContainer.appendChild( folderName );
    }

    folderElement.appendChild( folderTitleContainer );

    const expandedContent = document.createElement( 'div' );
    expandedContent.classList.add( 'expanded-content' );

    folder.children.forEach( child => {
      const itemElement = document.createElement( 'div' );
      itemElement.classList.add( 'folder-item' );

      if ( child.url ) { // It's a bookmark
        const link = document.createElement( 'a' );
        link.href = child.url;
        link.classList.add( 'bookmark-link' );
        itemElement.title = `${ child.title }`;

        const faviconSrc = `https://www.google.com/s2/favicons?sz=32&domain=${ child.url }`;
        const faviconEl = generateElements( `<img src='${ faviconSrc }' class='favicon'>`, link );

        itemElement.appendChild( link );

        link.addEventListener( 'click', () => {
          const activeTabEl = document.querySelector( '.active [role=document][src]' );
          activeTabEl.src = child.url;
        } );

      } else { // It's a subfolder
        itemElement.innerHTML = `<span class="subfolder-icon">📁</span>`;
        itemElement.classList.add( 'subfolder' );
        itemElement.title = child.title || 'Unnamed Folder';
      }

      expandedContent.appendChild( itemElement );
    } );

    folderElement.appendChild( expandedContent );

    // Add event listeners for hover
    folderElement.addEventListener( 'mouseenter', () => {
      folderElement.classList.add( 'expanded' );
    } );

    folderElement.addEventListener( 'mouseleave', () => {
      folderElement.classList.remove( 'expanded' );
    } );

    return folderElement;
  }

  // Function to add styles to the document
  function addStyles () {
    const styles = `
            .custom-folder {
                position: relative;
                cursor: pointer;
                padding: 5px;
                margin-right: 5px;
                border-radius: 4px;
                transition: all 0.3s ease;
            }

            .reload-button {
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

            .reload-button:hover {
                background-color: rgba(255, 255, 255, 0.2);
                transform: rotate(180deg);
            }

            .custom-folder:hover {
                background-color: rgba(255, 255, 255, 0.1);
            }

            .folder-title-container {
                display: flex;
                align-items: center;
                height: 16px;
            }

            .folder-name {
                position: relative;
                z-index: 2;
            }

            .folder-image {
                width: 16px;
                height: 16px;
                object-fit: contain;
            }

            .expanded-content {
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

            .custom-folder.expanded .expanded-content {
                opacity: 1;
                transform: translateY(0);
                pointer-events: auto;
            }

            .folder-item {
                width: 32px;
                height: 32px;
                transition: all 0.2s ease;
                border-radius: 4px;
                display: flex;
                justify-content: center;
                align-items: center;
            }

            .folder-item:hover {
                background-color: rgba(255, 255, 255, 0.1);
                transform: scale(1.1);
            }

            .bookmark-link {
                display: flex;
                align-items: center;
                justify-content: center;
                text-decoration: none;
                color: #ffffff;
                width: 100%;
                height: 100%;
            }

            .favicon {
                width: 32px;
                height: 32px;
            }

            .subfolder {
                font-size: 24px;
                color: #ffffff;
            }

            .folder-item::after {
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

            .folder-item:hover::after {
                opacity: 1;
            }
        `;

    const styleElement = document.createElement( 'style' );
    styleElement.textContent = styles;
    document.head.appendChild( styleElement );
  }

  function waitForAll ( selector ) {
    return new Promise( ( resolve ) => {
      if ( document.querySelector( selector ) ) {
        return resolve( document.querySelectorAll( selector ) );
      }

      const observer = new MutationObserver( () => {
        if ( document.querySelector( selector ) ) {
          resolve( document.querySelectorAll( selector ) );
          observer.disconnect();
        }
      } );

      observer.observe( document.body, { childList: true, subtree: true } );
    } );
  }

  function waitFor ( selector ) {
    return new Promise( ( resolve ) => {
      waitForAll( selector ).then( ( els ) => {
        resolve( els[ 0 ] );
      } );
    } );
  }

  function generateDoc ( html ) {
    let escapeHTMLPolicy = trustedTypes.createPolicy( "forceInner", {
      createHTML: ( to_escape ) => to_escape
    } );

    const template = document.createElement( 'template' );
    document.body.prepend( template );

    template.innerHTML = escapeHTMLPolicy.createHTML( html.trim() );

    const templateContent = template.content;
    template.remove();
    return templateContent;
  }

  function generateElements ( html, parent, returnTrusted ) {
    const doc = generateDoc( html, returnTrusted );
    const children = doc.children;
    let returnChildren = [ ...children ];
    if ( parent ) {
      returnChildren.length = 0;
      for ( const child of children ) {
        returnChildren.push(
          parent.appendChild( child ) );
      }
    }
    return returnChildren.length === 1 ? returnChildren[ 0 ] : returnChildren;
  }

  // Initialize the interface and add reload button
  await initializeInterface();
  addReloadButton();
} )();