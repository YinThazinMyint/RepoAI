# RepoAI

RepoAI is a code intelligence workspace for uploaded repositories. It helps developers add a GitHub repository or ZIP archive, generate repository documentation, create Mermaid diagrams, and ask AI questions about the codebase.

## Features

- Email/password authentication with JWT sessions
- Google and GitHub OAuth login
- Public GitHub URL and ZIP repository upload
- Private GitHub repository support after connecting GitHub
- Repository metadata extraction, file counting, and language/stack detection
- AI-generated project documentation and module documentation
- AI-generated Mermaid diagrams with PNG, PDF, and MMD export
- Repository-aware AI chat using indexed source chunks
- Dashboard summaries for repositories, diagrams, docs, and recent questions

## Tech Stack

### Backend

- Java 21
- Spring Boot 4
- Spring Security
- Spring Data JPA
- PostgreSQL
- pgvector for repository chunk embeddings
- OpenAI API for documentation, diagrams, chat, and embeddings
- Maven

### Frontend

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Axios
- Mermaid
- jsPDF
- Lucide React

## Project Structure

```text
repoai/
  backend/   Spring Boot API, auth, repository processing, AI generation
  frontend/  Next.js app, dashboard, repository views, docs, diagrams, chat
```

## Prerequisites

- Java 21
- Node.js 20 or newer
- npm
- PostgreSQL
- pgvector extension installed in PostgreSQL
- OpenAI API key
- Optional: GitHub and Google OAuth apps

## Backend Setup

Create or update `backend/src/main/resources/application.properties` with local values:

```properties
spring.datasource.url=jdbc:postgresql://localhost:5432/repoai
spring.datasource.username=postgres
spring.datasource.password=your_password

spring.jpa.hibernate.ddl-auto=update
spring.jpa.show-sql=true

app.frontend-url=http://localhost:3000
app.jwt.secret=replace-with-a-long-random-secret
app.jwt.expiration-ms=86400000

openai.api.key=your_openai_api_key
openai.base-url=https://api.openai.com/v1
openai.model=gpt-4.1
openai.embedding-model=text-embedding-3-small

rag.chunk.max-chars=3000
rag.chunk.overlap-chars=400
rag.retrieval.top-k=6
```

Optional OAuth configuration:

```properties
spring.security.oauth2.client.registration.github.client-id=your_github_client_id
spring.security.oauth2.client.registration.github.client-secret=your_github_client_secret
spring.security.oauth2.client.registration.github.scope=repo

spring.security.oauth2.client.registration.google.client-id=your_google_client_id
spring.security.oauth2.client.registration.google.client-secret=your_google_client_secret
spring.security.oauth2.client.registration.google.scope=openid,profile,email
```

Start the backend:

```powershell
cd backend
.\mvnw.cmd spring-boot:run
```

The backend runs at:

```text
http://localhost:8080
```

## Frontend Setup

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8080/api
NEXT_PUBLIC_LOGIN_URL=http://localhost:8080/login
```

Install dependencies and start the frontend:

```powershell
cd frontend
npm install
npm run dev
```

The app runs at:

```text
http://localhost:3000
```

## Database Setup

Create the database:

```sql
CREATE DATABASE repoai;
```

Enable pgvector in the `repoai` database:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Spring Boot creates and updates application tables automatically with `spring.jpa.hibernate.ddl-auto=update`.

## Common Commands

Backend tests:

```powershell
cd backend
.\mvnw.cmd test
```

Frontend lint:

```powershell
cd frontend
npm run lint
```

Frontend production build:

```powershell
cd frontend
npm run build
```

## Usage Flow

1. Start PostgreSQL, the backend, and the frontend.
2. Open `http://localhost:3000`.
3. Sign up with email/password or sign in with Google/GitHub.
4. Add a repository using a GitHub URL or ZIP upload.
5. Open the repository detail page.
6. Generate documentation, diagrams, and ask questions about the code.
7. Export diagrams as MMD, PNG, or PDF.

## Security Notes

- Do not commit real API keys, OAuth secrets, JWT secrets, or database passwords.
- Use local environment files or deployment secrets for production credentials.
- Rotate any credential that was accidentally committed or shared.

## License

No license has been specified yet.
