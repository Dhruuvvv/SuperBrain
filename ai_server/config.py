import os
import logging
from dotenv import load_dotenv

# Load environment variables robustly
env_paths = [
    ".env",
    "ai_server/.env",
    "ai/.env",
    os.path.join(os.path.dirname(__file__), ".env"),
    os.path.join(os.path.dirname(__file__), "..", "ai", ".env"),
]

loaded = False
for path in env_paths:
    if os.path.exists(path):
        load_dotenv(path)
        loaded = True
        break

if not loaded:
    load_dotenv()

# Setup Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("SuperBrain-AI")

# Constants
INVALID_TLD_PATTERNS = [
    "windows", "exe", "app", "zip", "rar", "pdf", "jpg", "png", "mp4", "dmg"
]

SOCIAL_DOMAINS = [
    "instagram.com", "facebook.com", "twitter.com", 
    "x.com", "tiktok.com", "youtube.com", "t.me"
]

GENERIC_TECH_TERMS = {
    "react", "reactjs", "react.js", "html", "css", "javascript", "js", "typescript", "ts",
    "nodejs", "node", "npm", "yarn", "pnpm", "python", "py", "pip", "poetry",
    "api", "sdk", "json", "sql", "graphql", "rest", "mongodb", "postgres", "postgresql",
    "mysql", "sqlite", "ai", "ml", "llm", "mcp", "rag", "agent", "tailwind", "tailwindcss",
    "nextjs", "next.js", "express", "fastapi", "django", "flask", "github", "gitlab", "bitbucket",
    "git", "docker", "kubernetes", "k8s", "aws", "gcp", "azure", "vercel", "netlify", "heroku", "render",
    "css-in-js", "styled-components", "sass", "less", "bootstrap", "material-ui", "mui", "shadcn",
    "shadcn/ui", "shadcn ui", "copilot", "chatgpt", "claude", "gemini", "llama", "deepseek",
    "linear", "stripe", "loom", "figma", "canva", "notion"
}
