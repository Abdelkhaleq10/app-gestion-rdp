# Application de gestion des accès RDP

## Description

Ce projet est une application web développée pour la gestion et la supervision des accès RDP au poste principal de SRM-SM.

L'objectif principal est d'organiser l'accès à un poste unique utilisé par plusieurs employés, afin d'éviter les conflits de connexion, de suivre l'état du poste en temps réel et de conserver un historique des connexions RDP.

## Objectifs du projet

- Contrôler l'accès au poste principal.
- Afficher l'état du poste : Libre ou Occupé.
- Permettre aux employés d'envoyer une demande d'accès.
- Notifier l'utilisateur actif lorsqu'une nouvelle demande arrive.
- Enregistrer les connexions, reconnexions et déconnexions RDP.
- Permettre au responsable de consulter les demandes et l'historique.
- Exporter les données sous format CSV.

## Technologies utilisées

- Next.js
- React.js
- TypeScript
- JavaScript
- PowerShell
- SQLite
- Tailwind CSS
- Windows Task Scheduler

## Structure principale du projet

```TXT
C:\Appel
├── app
│   ├── page.TS
│   ├── api
│   └── responsable
├── components
├── lit
├── public
├── scripts_RDP
├── logs_examples
├── popup-window.hta
├── rdp-realtime-monitor.js
├── rdp-history-monitor.js
└── run-rdp-status-loop.ps1