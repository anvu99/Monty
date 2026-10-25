from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.decisions import EndConversationRequest, ExtractionStatus
from app.services import decision_extraction as extraction

router = APIRouter()


@router.post("/coaching/conversations/end", response_model=ExtractionStatus, status_code=202)
def end_conversation(payload: EndConversationRequest, db: Session = Depends(get_db)):
    return extraction.enqueue(db, payload)


@router.get("/child/{child_id}/conversations/{conversation_id}/extraction", response_model=ExtractionStatus)
def get_status(child_id: str, conversation_id: str, db: Session = Depends(get_db)):
    return extraction.status(db, extraction.job_for_child(db, child_id, conversation_id))


@router.post("/child/{child_id}/conversations/{conversation_id}/extraction/retry", response_model=ExtractionStatus, status_code=202)
def retry(child_id: str, conversation_id: str, db: Session = Depends(get_db)):
    return extraction.retry(db, extraction.job_for_child(db, child_id, conversation_id))
