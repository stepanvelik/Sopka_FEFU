from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = Field(
        default="postgresql+asyncpg://sopka:sopka@localhost:5432/sopka",
        alias="DATABASE_URL",
    )
    cors_origins: str = Field(default="*", alias="CORS_ORIGINS")

    @property
    def cors_origins_list(self) -> list[str]:
        raw = self.cors_origins.strip()
        if raw == "*":
            return ["*"]
        return [x.strip() for x in raw.split(",") if x.strip()]


settings = Settings()
