markdown
# Skills & Conventions - Répertoire Particulier

> [!IMPORTANT]
> **Scope :** Ces règles s'appliquent exclusivement au dossier `/home/jminiko/insync/i-technologies/developpement/dolibarr/frontend` et à tous ses sous-dossiers.

## 🎯 Compétences du module
- fais moi une implémentation de l'application dans le répertoire suivant : 
/home/jminiko/insync/i-technologies/developpement/dolibarr/original ceci avec REA (reverse engineer Anything)
- utilise le langage typescript et le framework Vue.js + tailwind
- fais le frontend en vue.js dans le sous répertoire frontend

## 🛠️ Règles de développement
Réalise un  frontend à partir des API du backend  grails situé dans /home/jminiko/insync/i-technologies/developpement/dolibarr/backend
 
##Core Principles

Keep state predictable: one source of truth, derive everything else.
Make data flow explicit: Props down, Events up for most cases.
Decompose by responsibility: keep each implementation focused and the contracts between implementations explicit.
Avoid unnecessary re-renders: use computed properties and watchers wisely.
Readability counts: write clear, self-documenting code.
