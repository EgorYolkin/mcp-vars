class VariableError(Exception):
    """Base class for variable-domain errors."""


class VariableValidationError(VariableError):
    """Raised when tool input violates domain constraints."""


class VariableNotFoundError(VariableError):
    """Raised when a variable lookup misses."""


class VariableStorageError(VariableError):
    """Raised when the configured store fails unexpectedly."""
