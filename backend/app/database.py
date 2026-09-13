from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from backend.app.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    import backend.app.models  # noqa: F401
    Base.metadata.create_all(bind=engine)

    if "sqlite" in settings.DATABASE_URL:
        from sqlalchemy import text
        with engine.connect() as conn:
            for query in [
                "ALTER TABLE quotes ADD COLUMN input_hash VARCHAR(64)",
                "ALTER TABLE deliveries ADD COLUMN output_data TEXT",
                "ALTER TABLE deliveries ADD COLUMN receipt_json TEXT",
            ]:
                try:
                    conn.execute(text(query))
                    conn.commit()
                except Exception:
                    pass
