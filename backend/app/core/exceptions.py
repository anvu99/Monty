from fastapi import HTTPException, status


class NotFoundError(HTTPException):
    """Raised when a requested resource does not exist in the database."""

    def __init__(self, resource: str, id: str):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{resource} with id '{id}' not found.",
        )


class UnauthorizedError(HTTPException):
    """Raised when a request is missing or has an invalid auth token."""

    def __init__(self, detail: str = "Not authenticated"):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"},
        )


class ForbiddenError(HTTPException):
    """Raised when an authenticated user tries to access a resource they don't own."""

    def __init__(self, detail: str = "You do not have permission to access this resource"):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail,
        )


class ConflictError(HTTPException):
    """Raised on duplicate resource creation (e.g., email already registered)."""

    def __init__(self, detail: str = "Resource already exists"):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail=detail,
        )
