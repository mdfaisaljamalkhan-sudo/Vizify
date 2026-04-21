"""
In-process pub/sub for real-time dashboard collaboration.
Each dashboard_id has a set of asyncio.Queue listeners.
Works for single-process deployments (HuggingFace free tier).
"""
import asyncio
import json
import logging
from collections import defaultdict
from typing import AsyncIterator

logger = logging.getLogger(__name__)

# dashboard_id → set of asyncio.Queue
_listeners: dict[str, set[asyncio.Queue]] = defaultdict(set)


def subscribe(channel: str) -> asyncio.Queue:
    """Register a new SSE listener for a channel. Returns its queue."""
    q: asyncio.Queue = asyncio.Queue(maxsize=50)
    _listeners[channel].add(q)
    logger.debug(f"SSE subscribe: channel={channel} total={len(_listeners[channel])}")
    return q


def unsubscribe(channel: str, q: asyncio.Queue) -> None:
    _listeners[channel].discard(q)
    if not _listeners[channel]:
        del _listeners[channel]


def broadcast(channel: str, event_type: str, data: dict) -> None:
    """Fire-and-forget broadcast to all listeners on a channel."""
    if channel not in _listeners:
        return
    payload = json.dumps({"type": event_type, "data": data})
    dead = set()
    for q in list(_listeners[channel]):
        try:
            q.put_nowait(payload)
        except asyncio.QueueFull:
            dead.add(q)
    for q in dead:
        _listeners[channel].discard(q)


def listener_count(channel: str) -> int:
    return len(_listeners.get(channel, set()))


async def event_stream(channel: str) -> AsyncIterator[str]:
    """Async generator that yields SSE-formatted strings."""
    q = subscribe(channel)
    try:
        # Send initial "connected" event with current viewer count
        yield f"data: {json.dumps({'type': 'connected', 'viewers': listener_count(channel)})}\n\n"
        # Broadcast viewer count update to everyone on this channel
        broadcast(channel, "viewers", {"count": listener_count(channel)})
        while True:
            try:
                payload = await asyncio.wait_for(q.get(), timeout=25.0)
                yield f"data: {payload}\n\n"
            except asyncio.TimeoutError:
                # Keep-alive ping every 25s so proxies don't close the connection
                yield ": ping\n\n"
    except asyncio.CancelledError:
        pass
    finally:
        unsubscribe(channel, q)
        broadcast(channel, "viewers", {"count": listener_count(channel)})
