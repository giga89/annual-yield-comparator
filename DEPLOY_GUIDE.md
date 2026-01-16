# Come Pubblicare su GitHub Pages

Ecco i passaggi semplici per mettere il tuo sito online gratuitamente usando GitHub Pages.

## Prerequisiti
Devi avere un account su [GitHub](https://github.com).

## Passaggi

1.  **Crea un repository su GitHub:**
    *   Vai su GitHub e clicca su "New repository".
    *   Dai un nome al repository (es. `performance-comparator`).
    *   Assicurati che sia **Public**.
    *   Clicca su "Create repository".

2.  **Carica i file:**
    *   Nel tuo terminale locale, naviga nella cartella del progetto.
    *   Inizializza git (se non l'hai già fatto):
        ```bash
        git init
        git add .
        git commit -m "Initial commit"
        ```
    *   Collega il repository remoto (copia il comando dalla pagina di GitHub dopo aver creato il repo):
        ```bash
        git remote add origin https://github.com/IL_TUO_USERNAME/performance-comparator.git
        git branch -M main
        git push -u origin main
        ```

3.  **Attiva GitHub Pages:**
    *   Vai nella pagina del tuo repository su GitHub.
    *   Clicca su **Settings** (in alto a destra).
    *   Nel menu a sinistra, clicca su **Pages**.
    *   Sotto "Build and deployment", alla voce **Source**, seleziona **Deploy from a branch**.
    *   Sotto **Branch**, seleziona `main` e la cartella `/ (root)`.
    *   Clicca **Save**.

4.  **Finito!**
    *   GitHub impiegherà qualche minuto. Ricarica la pagina.
    *   Vedrai un link in alto: "Your site is live at...". Cliccaci per vedere la tua app online!
