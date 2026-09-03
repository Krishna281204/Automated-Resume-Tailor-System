# 🎯 Automated Resume Tailor

Applying to jobs shouldn't mean spending hours manually rewriting your resume for every single application. 

**Automated Resume Tailor** is an intelligent tool that automatically rewrites and tailors your existing resume to perfectly match a specific Job Description (JD). It acts as an expert recruiter — highlighting your most relevant skills and achievements without making up fake information.

## ✨ What it does

1. **You provide the inputs:** Upload your existing resume (as a LaTeX `.zip` file), paste the Job Description, and optionally add any specific instructions (like "keep it to one page").
2. **AI does the heavy lifting:** Our intelligent agent analyzes the job posting to figure out exactly what the employer is looking for. It then intelligently rewrites your resume's bullet points to highlight the exact skills, tools, and experiences that match the job.
3. **Your tailored resume is ready:** Within seconds, you get a perfectly customized resume. 

## 🚀 Key Features

- **Smart Tailoring, Not Just Copy-Pasting:** The AI follows a strict 7-step reasoning process. It understands the core responsibilities of the role and tailors your past experience to align with them, rather than just blindly stuffing keywords.
- **Overleaf Integration:** No need to install clunky LaTeX compilers on your computer. Once the AI finishes tailoring, you can click "Open in Overleaf" to instantly open your customized code in the browser and compile it to a PDF.
- **Real-time Feedback:** A beautiful, modern web interface that keeps you updated on exactly what the AI is thinking and doing at every step.
- **Download Anywhere:** Get your modified LaTeX source code directly to your local machine with one click.

## 🛠️ How it works under the hood

While the experience is simple, the backend is powered by modern AI tooling:
- **Frontend:** A sleek, glassmorphic React interface built with Vite.
- **Backend:** A fast FastAPI server that streams real-time updates to the frontend.
- **Intelligence:** Powered by Google's Gemini LLMs and LangGraph, the AI agent is orchestrated into distinct steps (Extraction, Analysis, Modification, and Compilation) to ensure reliable, high-quality results every time.

## 🏁 Getting Started

### Prerequisites
- Node.js (for the frontend)
- Python 3.9+ (for the backend)
- A Gemini API Key (get one from Google AI Studio)

### Setup

1. **Clone the repository**
2. **Setup the Backend:**
   ```bash
   cd backend
   python -m venv venv
   source venv/Scripts/activate  # Or venv/bin/activate on Mac/Linux
   pip install -r requirements.txt
   ```
   *Create a `.env` file in the backend folder and add your API key:*
   `GEMINI_API_KEY=your_api_key_here`

3. **Setup the Frontend:**
   ```bash
   cd frontend
   npm install
   ```

### Running the App

Start the backend:
```bash
cd backend
uvicorn main:app --port 8000
```

Start the frontend:
```bash
cd frontend
npm run dev
```

Open `http://localhost:5173` in your browser and start tailoring!
