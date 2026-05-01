# 🛠️ FlowTrack Backend

Le backend de FlowTrack est construit avec **NestJS**, un framework Node.js progressif pour construire des applications côté serveur efficaces et scalables.

## 🚀 Installation

1. Installez les dépendances :
```bash
npm install
```

2. Configurez les variables d'environnement :
```bash
cp .env.example .env
```

3. Lancez l'infrastructure Docker :
```bash
docker-compose up -d
```

4. Initialisez Prisma et la base de données :
```bash
npx prisma migrate dev
npm run prisma:seed
```

## 📜 Scripts disponibles

- `npm run start:dev` : Lance le serveur en mode développement avec watch mode.
- `npm run build` : Compile le projet pour la production.
- `npm run start:prod` : Lance le serveur compilé.
- `npm run lint` : Vérifie le style du code.
- `npm run test` : Lance les tests unitaires.
- `npx prisma studio` : Ouvre l'interface graphique pour explorer la base de données.

## 📁 Structure du projet

- `src/` : Code source NestJS.
- `prisma/` : Schéma de base de données et scripts de seed.
- `test/` : Tests de bout en bout (E2E).

## 🔐 Sécurité

Le backend utilise JWT pour l'authentification. Assurez-vous de changer `JWT_ACCESS_SECRET` et `JWT_REFRESH_SECRET` dans votre fichier `.env` en production.
