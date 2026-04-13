from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    supabase_url: str
    supabase_key: str
    supabase_jwt_secret: str
    backend_port: int = 8000
    frontend_url: str = "http://localhost:5173"
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"

    model_config = {"env_file": "../.env", "env_file_encoding": "utf-8"}


settings = Settings()
