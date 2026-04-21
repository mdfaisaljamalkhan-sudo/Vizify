DEMO_USER_ID = "00000000-0000-0000-0000-000000000001"


async def get_current_user() -> str:
    """Returns the shared anonymous user ID — no auth required."""
    return DEMO_USER_ID
