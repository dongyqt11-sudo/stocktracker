from datetime import date, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.notes import Note

router = APIRouter(prefix="/notes", tags=["notes"])


class NoteCreate(BaseModel):
    account_id: str = "account_1"
    account_name: str = "Account 1"
    title: str = ""
    note_date: date
    content: str
    related_stock_code: str | None = None


class NoteUpdate(BaseModel):
    title: str | None = None
    note_date: date | None = None
    content: str | None = None
    related_stock_code: str | None = None


class NoteOut(BaseModel):
    id: int
    account_id: str
    account_name: str
    title: str
    note_date: date
    content: str
    related_stock_code: str | None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


def _note_dict(row: Note) -> dict[str, Any]:
    return {
        "id": row.id,
        "account_id": row.account_id,
        "account_name": row.account_name,
        "title": row.title,
        "note_date": row.note_date.isoformat(),
        "content": row.content,
        "related_stock_code": row.related_stock_code,
        "content_preview": row.content[:80].replace("\n", " "),
        "created_at": row.created_at.isoformat(sep=" "),
    }


@router.get("")
def list_notes(
    stock_code: str | None = Query(default=None),
    account_id: str = Query(default="account_1"),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    query = select(Note).where(Note.account_id == account_id).order_by(desc(Note.note_date), desc(Note.id))
    if stock_code:
        query = query.where(Note.related_stock_code.contains(stock_code.strip()))
    return [_note_dict(row) for row in db.scalars(query)]


@router.get("/{note_id}")
def get_note(
    note_id: int,
    account_id: str = Query(default="account_1"),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    note = db.get(Note, note_id)
    if note is None or note.account_id != account_id:
        raise HTTPException(status_code=404, detail="笔记不存在")
    return _note_dict(note)


@router.post("")
def create_note(payload: NoteCreate, db: Session = Depends(get_db)) -> dict[str, Any]:
    note = Note(
        account_id=payload.account_id,
        account_name=payload.account_name,
        title=payload.title,
        note_date=payload.note_date,
        content=payload.content,
        related_stock_code=payload.related_stock_code,
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return _note_dict(note)


@router.put("/{note_id}")
def update_note(
    note_id: int,
    payload: NoteUpdate,
    account_id: str = Query(default="account_1"),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    note = db.get(Note, note_id)
    if note is None or note.account_id != account_id:
        raise HTTPException(status_code=404, detail="笔记不存在")
    if payload.title is not None:
        note.title = payload.title
    if payload.note_date is not None:
        note.note_date = payload.note_date
    if payload.content is not None:
        note.content = payload.content
    if "related_stock_code" in payload.model_fields_set:
        note.related_stock_code = payload.related_stock_code
    db.commit()
    db.refresh(note)
    return _note_dict(note)


@router.delete("/{note_id}")
def delete_note(
    note_id: int,
    account_id: str = Query(default="account_1"),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    note = db.get(Note, note_id)
    if note is None or note.account_id != account_id:
        raise HTTPException(status_code=404, detail="笔记不存在")
    db.delete(note)
    db.commit()
    return {"status": "deleted"}
