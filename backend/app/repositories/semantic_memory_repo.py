import re

from sqlalchemy import case, func, literal
from app.models.semantic_memory import SemanticMemory

STOPWORDS = frozenset("a an and are as at be been but by can could did do does for from had has have he her hers him his how i if in into is it its me my of on or our ours she should so some than that the their them then there these they this those to too us was we were what when where which who why will with would you your yours please about also just now tell help know want like".split())


def query_terms(text: str) -> list[str]:
    return list(dict.fromkeys(term for term in re.findall(r"[^\W_]+", text.lower())
                              if len(term) >= 2 and term not in STOPWORDS))[:20]


class SemanticMemoryRepository:
    def __init__(self, db):
        self.db = db

    def active(self, child_id):
        return self.db.query(SemanticMemory).filter_by(child_id=child_id, status="active")

    def retrieve(self, child_id: str, text: str, limit: int = 5):
        terms = query_terms(text)
        if not terms:
            return []
        score = literal(0)
        for term in terms:
            for column, weight in ((SemanticMemory.name, 4), (SemanticMemory.topic, 2),
                                   (SemanticMemory.summary, 1), (SemanticMemory.details, 1)):
                score = score + case((func.lower(func.coalesce(column, "")).contains(term, autoescape=True), weight), else_=0)
        return self.active(child_id).filter(score > 0).order_by(
            score.desc(), SemanticMemory.updated_at.desc(), SemanticMemory.id.asc()).limit(limit).all()

    def latest(self, child_id, key):
        return self.db.query(SemanticMemory).filter_by(child_id=child_id, memory_key=key).order_by(
            SemanticMemory.revision.desc()).first()
