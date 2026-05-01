# 🚀 FlowTrack

![FlowTrack Dashboard](flowtrack_dashboard_mockup.png)

FlowTrack est une plateforme de gestion de projet moderne et performante, inspirée de Jira et Linear. Elle offre une interface intuitive pour la gestion de tickets, de workflows et la collaboration d'équipe en temps réel.

## ✨ Fonctionnalités

- **Tableau Kanban Interactif** : Déplacez vos tickets avec un simple glisser-déposer.
- **Gestion des Workflows** : Personnalisez les cycles de vie de vos tâches.
- **Collaboration en Temps Réel** : Mises à jour instantanées via WebSockets.
- **Authentification Sécurisée** : Gestion robuste via JWT.
- **Interface Premium** : Un design épuré, réactif et optimisé pour la productivité.

## 🛠️ Stack Technique

### Frontend
- **Framework** : Next.js 16 (App Router)
- **State Management** : Zustand & React Query
- **Styling** : Tailwind CSS 4
- **Real-time** : Socket.io-client
- **Icônes** : Lucide React

### Backend
- **Framework** : NestJS
- **ORM** : Prisma
- **Base de données** : PostgreSQL
- **Cache & Queues** : Redis
- **Real-time** : Socket.io
- **Authentification** : Passport.js & JWT

---

## 🚀 Installation et Configuration

### 📋 Prérequis

- **Node.js** (v20 ou supérieur)
- **Docker & Docker Compose**
- **npm** ou **yarn**

### 1. Cloner le projet
```bash
git clone https://github.com/votre-utilisateur/flowtrack.git
cd flowtrack
```

### 2. Configuration du Backend
```bash
cd backend
npm install
```

Créez un fichier `.env` en copiant le fichier d'exemple :
```bash
cp .env.example .env
```
*Note : Modifiez les variables d'environnement si nécessaire.*

Lancez l'infrastructure (PostgreSQL & Redis) :
```bash
docker-compose up -d
```

Initialisez la base de données :
```bash
npx prisma migrate dev
npm run prisma:seed
```

Lancez le serveur de développement :
```bash
npm run start:dev
```

### 3. Configuration du Frontend
```bash
cd ../flowtrack-app
npm install
```

Créez un fichier `.env.local` :
```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
NEXT_PUBLIC_SOCKET_URL=http://localhost:3000
```

Lancez l'application :
```bash
npm run dev
```

L'application est maintenant accessible sur [http://localhost:3001](http://localhost:3001) (ou le port spécifié).

---

## 🏗️ Architecture du Projet

```text
flowtrack/
├── backend/            # API NestJS (Logique métier & Base de données)
├── flowtrack-app/      # Frontend Next.js (Interface utilisateur)
└── docker-compose.yml  # Infrastructure (PostgreSQL, Redis)
```

## 📚 Documentation Supplémentaire

Pour des détails techniques approfondis sur l'intégration et les APIs, consultez :
- [Guide d'Intégration Frontend](frontend_info.md) : Détails des endpoints, authentification et événements Socket.io.
- [README Backend](backend/README.md) : Détails sur la configuration du serveur et des outils Prisma.

## 📜 Licence

Ce projet est sous licence MIT. Voir le fichier [LICENSE](LICENSE) pour plus de détails.

---

Développé avec ❤️ par l'équipe FlowTrack.
