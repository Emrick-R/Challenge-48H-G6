# Qui a la ref ?

Quiz battle royale multijoueur oriente pop culture, pense pour un ecran principal sur PC ou videoprojecteur et des joueurs qui repondent depuis leur telephone.

Le projet repose sur un front React/Vite, une API Express, une base Turso/libSQL et un moteur de partie stateless pilote par polling HTTP.

## Vision du projet

`Qui a la ref ?` reprend la logique d'un quiz show :

- un hote cree une room
- les joueurs rejoignent avec un code ou un QR code
- l'ecran principal affiche question, timer, media, leaderboard et resultats
- les joueurs repondent depuis leur telephone
- les scores sont calcules cote serveur
- toutes les 120 secondes, le plus faible score est elimine
- les joueurs elimines restent visibles mais grises
- le dernier joueur vivant gagne

## Stack technique

- Front : React 19 + Vite
- UI : Tailwind CSS v4 + Heroicons
- Routing : React Router
- Backend : Express 5
- Base de donnees : Turso / libSQL
- Temps reel : polling HTTP
- QR code : `qrcode.react`

## Choix d'architecture

- le serveur est l'unique source de verite pour :
  - score
  - timer
  - bonne reponse
  - elimination
  - phases de partie
- aucune room n'est conservee en memoire
- les transitions sont recalculees a partir des timestamps enregistres en base
- le front ne decide jamais de l'etat de la partie, il le lit
- l'application est compatible avec un deploiement Vercel + Turso

## Fonctionnalites deja prises en charge

- creation de room
- join de room par code
- QR code de join
- room limitee a 8 joueurs
- questions QCM limitees a 4 reponses `A / B / C / D`
- cycle `question_live -> answer_reveal`
- leaderboard live
- calcul de score cote serveur
- elimination automatique
- fin de partie avec podium final
- banque de questions avec medias
- affichage image / audio / video
- interfaces separees PC / mobile

## Reponses aux besoins du projet

### 1. Connexion backend vers base de donnees

Oui.

- fichier principal : [server/db.js](C:\Users\eporc\Documents\GitHub\Challenge-48H-G6\server\db.js)
- client utilise : `@libsql/client`
- bootstrap local disponible avec `npm run db:bootstrap`

### 2. Creation et join de room

Oui.

- `POST /api/rooms`
- `POST /api/rooms/:roomCode/players`

### 3. Cycle de question

Oui.

Phases gerees :

- `waiting`
- `question_live`
- `answer_reveal`
- `finished`

### 4. Calcul des scores

Oui, cote serveur uniquement.

- aucun calcul de score n'est fait cote front

### 5. Leaderboard temps reel

Oui.

- visible sur l'ecran principal
- visible aussi cote joueur en version compacte

### 6. Elimination toutes les 120 secondes

Oui.

- le timer d'elimination est gere cote serveur
- l'elimination a lieu apres une phase de resultat, pas au milieu d'une question

### 7. Joueur elimine cote mobile et ecran principal

Oui.

- etat `eliminated`
- le joueur reste affiche
- le rendu est visuellement attenue

## Parcours utilisateur

### Ecran principal

- page d'accueil / creation de room
- lobby avec QR code et code salle
- lancement de partie
- affichage de la question
- affichage du media eventuel
- affichage des 4 reponses
- leaderboard live
- resultat de la bonne reponse
- annonce d'elimination
- ecran final avec classement

### Telephone joueur

- entree dans la room par code ou QR
- saisie du pseudo
- affichage de la question
- grille de reponses `A / B / C / D`
- affichage "reponse envoyee"
- correction
- elimination ou victoire
- resume final

## Structure du projet

### Front

- [src/App.jsx](C:\Users\eporc\Documents\GitHub\Challenge-48H-G6\src\App.jsx)
- [src/pages/WelcomePage.jsx](C:\Users\eporc\Documents\GitHub\Challenge-48H-G6\src\pages\WelcomePage.jsx)
- [src/pages/ScanQr.jsx](C:\Users\eporc\Documents\GitHub\Challenge-48H-G6\src\pages\ScanQr.jsx)
- [src/pages/MainScreen.jsx](C:\Users\eporc\Documents\GitHub\Challenge-48H-G6\src\pages\MainScreen.jsx)
- [src/components/Game.jsx](C:\Users\eporc\Documents\GitHub\Challenge-48H-G6\src\components\Game.jsx)
- [src/components/Leaderboard.jsx](C:\Users\eporc\Documents\GitHub\Challenge-48H-G6\src\components\Leaderboard.jsx)
- [src/components/EventOverlay.jsx](C:\Users\eporc\Documents\GitHub\Challenge-48H-G6\src\components\EventOverlay.jsx)
- [src/components/StatusPopup.jsx](C:\Users\eporc\Documents\GitHub\Challenge-48H-G6\src\components\StatusPopup.jsx)
- [src/components/VictoryPodium.jsx](C:\Users\eporc\Documents\GitHub\Challenge-48H-G6\src\components\VictoryPodium.jsx)

### Backend

- [api/index.js](C:\Users\eporc\Documents\GitHub\Challenge-48H-G6\api\index.js)
- [server/app.js](C:\Users\eporc\Documents\GitHub\Challenge-48H-G6\server\app.js)
- [server/index.js](C:\Users\eporc\Documents\GitHub\Challenge-48H-G6\server\index.js)
- [server/db.js](C:\Users\eporc\Documents\GitHub\Challenge-48H-G6\server\db.js)
- [server/repositories/gameRepository.js](C:\Users\eporc\Documents\GitHub\Challenge-48H-G6\server\repositories\gameRepository.js)
- [server/services/gameOrchestrator.js](C:\Users\eporc\Documents\GitHub\Challenge-48H-G6\server\services\gameOrchestrator.js)

### Base et questions

- [database/turso-schema.sql](C:\Users\eporc\Documents\GitHub\Challenge-48H-G6\database\turso-schema.sql)
- [database/turso-seed.sql](C:\Users\eporc\Documents\GitHub\Challenge-48H-G6\database\turso-seed.sql)
- [question/question-bank.normalized.json](C:\Users\eporc\Documents\GitHub\Challenge-48H-G6\question\question-bank.normalized.json)
- [question/question-bank.report.md](C:\Users\eporc\Documents\GitHub\Challenge-48H-G6\question\question-bank.report.md)

## Variables d'environnement

Voir le modele complet dans [.env.example](C:\Users\eporc\Documents\GitHub\Challenge-48H-G6\.env.example).

### Backend

- `PORT`
- `CLIENT_ORIGIN`
- `ENIGMA_RUNTIME_MODE`
- `REQUEST_TIMEOUT_MS`
- `POLLING_INTERVAL_MS`
- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `TURSO_BOOTSTRAP_ON_START`
- `DEFAULT_ELIMINATION_INTERVAL_SECONDS`
- `DEFAULT_MAX_PLAYERS`

### Front

- `VITE_API_URL`
- `VITE_PUBLIC_APP_URL`
- `VITE_POLLING_INTERVAL_MS`

## Installation locale

1. Copier `.env.example` vers `.env`
2. Installer les dependances :

```bash
npm install
```

3. Initialiser la base locale :

```bash
npm run db:bootstrap
```

4. Lancer le backend :

```bash
npm run dev:server
```

5. Lancer le front :

```bash
npm run dev
```

Par defaut :

- API : `http://localhost:3001`
- Front : `http://localhost:5173`

Si `5173` est deja pris, Vite peut demarrer sur `5174` ou un autre port libre.

## Scripts utiles

```bash
npm run dev
npm run dev:server
npm run db:bootstrap
npm run questions:prepare
npm run questions:import
npm run questions:validate
npm run lint
npm run build
npm run preview
npm run server
```

## API REST

### Sante

`GET /api/health`

Reponse :

```json
{
  "ok": true,
  "serverTime": 1774950926115,
  "runtime": {
    "mode": "persistent",
    "transport": "http-polling",
    "pollingIntervalMs": 1000
  },
  "db": {
    "ok": true
  }
}
```

### Creer une room

`POST /api/rooms`

Exemple :

```json
{
  "hostName": "Host Qui a la ref ?",
  "themeId": 3,
  "maxPlayers": 8
}
```

### Rejoindre une room

`POST /api/rooms/:roomCode/players`

Exemple :

```json
{
  "nickname": "Alice"
}
```

### Lancer une partie

`POST /api/rooms/:roomCode/start`

### Envoyer une reponse

`POST /api/rooms/:roomCode/answers`

Exemple :

```json
{
  "playerId": 12,
  "choiceId": 54
}
```

### Lire l'etat courant

`GET /api/rooms/:roomCode/state`

Parametres possibles :

- `role=screen`
- `role=player`
- `playerId=<id>`

## Temps reel cote front

Le jeu ne passe pas par WebSocket.

Le front interroge periodiquement l'etat de room :

- ecran principal : lecture d'etat de room
- mobile joueur : lecture d'etat + soumission des reponses

Le polling est configure par :

- `POLLING_INTERVAL_MS`
- `VITE_POLLING_INTERVAL_MS`

## Banque de questions

Le dossier [question](C:\Users\eporc\Documents\GitHub\Challenge-48H-G6\question) contient les sources de questions et medias.

Pipeline :

1. normalisation
2. validation
3. copie des medias dans `public/question-assets`
4. import en base

Scripts :

```bash
npm run questions:prepare
npm run questions:import
npm run questions:validate
```

## Tests realises sur le projet

Tests techniques :

- `npm run lint`
- `npm run build`
- `npm run db:bootstrap`
- `npm run questions:validate`

Tests backend :

- `GET /api/health`
- creation de room
- join de plusieurs joueurs
- lancement de partie
- lecture d'etat en `question_live`
- envoi de reponse
- passage en `answer_reveal`
- fin de partie

Tests metier :

- room bloquee a 8 joueurs
- questions jouables limitees a 4 reponses `A/B/C/D`
- ordre des questions randomise
- joueur elimine toujours visible
- elimination retardee jusqu'apres la phase de resultat
- victoire finale avec classement

## Deploiement Vercel + Turso

1. Creer une base Turso
2. Importer :

- [database/turso-schema.sql](C:\Users\eporc\Documents\GitHub\Challenge-48H-G6\database\turso-schema.sql)
- [database/turso-seed.sql](C:\Users\eporc\Documents\GitHub\Challenge-48H-G6\database\turso-seed.sql)

3. Ajouter sur Vercel :

```env
CLIENT_ORIGIN=https://votre-front.vercel.app
ENIGMA_RUNTIME_MODE=serverless
REQUEST_TIMEOUT_MS=10000
POLLING_INTERVAL_MS=1000
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=...
DEFAULT_ELIMINATION_INTERVAL_SECONDS=120
DEFAULT_MAX_PLAYERS=8
VITE_API_URL=https://votre-front.vercel.app
VITE_PUBLIC_APP_URL=https://votre-front.vercel.app
VITE_POLLING_INTERVAL_MS=1000
```

4. Redeployer le projet

Le routing Vercel est deja prepare dans [vercel.json](C:\Users\eporc\Documents\GitHub\Challenge-48H-G6\vercel.json).

## Limites actuelles

- l'autoplay audio/video depend encore des restrictions du navigateur
- l'ergonomie desktop continue d'etre ajustee selon la longueur des textes
- certaines animations sont decoratives et peuvent encore etre affinees
- le projet vise un MVP jouable, pas une version tournoi/production complete

## Resume

Le projet fournit aujourd'hui un MVP jouable de quiz battle royale avec :

- une room multijoueur
- un grand ecran animateur
- un client mobile joueur
- des questions media
- un systeme d'elimination
- un classement final
- une architecture compatible Vercel + Turso

Hypothese prise pour ce README :

- j'ai interprete `ses reponses` comme `les reponses du projet aux besoins fonctionnels et techniques`, donc j'ai ajoute une section dediee qui relie les attentes du projet a ce qui est deja implemente.
