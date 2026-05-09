# Codeurtool

Web app for students to build HTML projects with a sandboxed live preview, version history, publishing to a public URL, and instructor-led classes with join codes. Stack: **Vite + React + TypeScript + Firebase** (Auth + Firestore).

## Features (MVP)

- Register as **student** or **instructor** (role is fixed after account creation; see security note below).
- **Students**: create projects, edit metadata (name, grade level, subject, topic, description), paste HTML, preview in an iframe, save versions, publish/unpublish, link a project to a class for submission, join classes with a code.
- **Instructors**: create classes (join code generated), open roster with submission counts, remove a student (deletes their projects in that class), delete individual class projects.
- **Public** pages at `/p/:projectId` read only from `publicProjects` (draft HTML in `projects` is not exposed there).

## Setup

1. Create a [Firebase](https://console.firebase.google.com/) project.
2. Enable **Authentication → Email/Password**.
3. Create a **Firestore** database (production mode is fine once rules are deployed).
4. Project settings → Your apps → Web app → copy config into `.env`:

```bash
cp .env.example .env
# fill VITE_FIREBASE_* values
```

5. Deploy security rules and indexes (requires [Firebase CLI](https://firebase.google.com/docs/cli)):

```bash
firebase login
firebase init firestore   # select this folder, use existing firestore.rules / firestore.indexes.json
firebase deploy --only firestore
```

If the CLI proposes `firestore.rules`, point it at the files in this repo root.

6. Install and run locally:

```bash
npm install
npm run dev
```

Open the URL shown (usually `http://localhost:5173`).

## Firestore layout

- `users/{uid}` — profile (`displayName`, `email`, `role`, `createdAt`).
- `classes/{classId}` — `name`, `instructorId`, `joinCode`, `createdAt`.
- `joinLinks/{joinCode}` — `classId`, `className` (lets students resolve a code without reading all classes).
- `classes/{classId}/members/{uid}` — roster.
- `userClasses/{uid}/items/{classId}` — denormalized list for dashboards (`className`, `role`, `joinedAt`).
- `projects/{projectId}` — draft `html`, metadata, `ownerId`, optional `classId`, `isPublished`, etc.
- `projects/{projectId}/versions/{versionId}` — snapshots.
- `publicProjects/{projectId}` — published snapshot fields including `html` (world-readable by id).

## Security note on roles

Firestore rules prevent **changing** `role` after signup, but the first write still comes from the client. For a production university deployment, set roles with the **Admin SDK** (Cloud Function / trusted script) or **custom claims** so accounts cannot self-assign instructor.

## Build

```bash
npm run build
```

Static output is in `dist/` — host on Firebase Hosting, Netlify, or similar, with SPA fallback to `index.html` for client routes.
