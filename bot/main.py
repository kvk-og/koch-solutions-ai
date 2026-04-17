import os
import json
import logging
from functools import wraps

import httpx
from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes

# =============================================================================
# Configuration
# =============================================================================

TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
ALLOWED_USER_IDS_STR = os.getenv("ALLOWED_USER_IDS", "")
# Default resolving to backend-api inside docker-compose
BACKEND_API_URL = os.getenv("BACKEND_API_URL", "http://backend-api:8000")

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s", level=logging.INFO
)
logger = logging.getLogger("koch-telegram-bot")

# Parse allowed IDs safely
ALLOWED_USER_IDS = set()
for uid in ALLOWED_USER_IDS_STR.split(","):
    uid = uid.strip()
    if uid:
        try:
            ALLOWED_USER_IDS.add(int(uid))
        except ValueError:
            logger.warning(f"Invalid user ID in ALLOWED_USER_IDS: {uid}")

# =============================================================================
# Security & Helpers
# =============================================================================

def authorized_only(func):
    """Decorator to securely drop messages from unauthorized users."""
    @wraps(func)
    async def wrapper(update: Update, context: ContextTypes.DEFAULT_TYPE, *args, **kwargs):
        if update.effective_user is None:
            return
            
        user_id = update.effective_user.id
        if user_id not in ALLOWED_USER_IDS:
            logger.warning(f"Unauthorized access attempt from User ID: {user_id}")
            # Provide a firm denial
            await update.message.reply_text("⛔ Unauthorized. You do not have access to the KOCH AI Field System.")
            return
            
        return await func(update, context, *args, **kwargs)
    return wrapper

# =============================================================================
# Command Workflows
# =============================================================================

@authorized_only
async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    help_text = (
        "🤖 *KOCH AI Field Assistant*\n\n"
        "Commands:\n"
        "`/note [Machine_ID] [Observation]` - Add an observation to the Machine Book.\n"
        "`/ask [Machine_ID] [Question]` - Query the local Hermes Agent about a machine."
    )
    await update.message.reply_text(help_text, parse_mode="Markdown")


@authorized_only
async def note_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if len(context.args) < 2:
        await update.message.reply_text("Usage: `/note [Machine_ID] [Observation]`", parse_mode="Markdown")
        return

    machine_id = context.args[0]
    observation_text = " ".join(context.args[1:])

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                f"{BACKEND_API_URL}/api/internal/field-note",
                json={"machine_id": machine_id, "text": observation_text}
            )
            response.raise_for_status()
        
        await update.message.reply_text(f"✅ Note successfully added to the digital thread for `{machine_id}`.", parse_mode="Markdown")
    except httpx.HTTPError as e:
        logger.error(f"Failed to post note: {e}")
        await update.message.reply_text(f"❌ Failed to reach the KOCH AI backend. Please try again later.")


@authorized_only
async def ask_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if len(context.args) < 2:
        await update.message.reply_text("Usage: `/ask [Machine_ID] [Question]`", parse_mode="Markdown")
        return

    machine_id = context.args[0]
    question_text = " ".join(context.args[1:])
    
    # Send a quick processing message
    status_msg = await update.message.reply_text(f"🧠 Querying Hermes Agent for `{machine_id}`...", parse_mode="Markdown")

    prompt = f"Regarding Machine {machine_id}: {question_text}"

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            headers = {"Content-Type": "application/json"}
            payload = {
                "query": prompt,
                "temperature": 0.3,
                "max_tokens": 1024
            }

            full_response = ""
            async with client.stream("POST", f"{BACKEND_API_URL}/api/chat", json=payload, headers=headers) as response:
                response.raise_for_status()
                # Parse server-sent events
                async for line in response.aiter_lines():
                    line = line.strip()
                    if line.startswith("data: "):
                        data_str = line[6:]
                        try:
                            event_data = json.loads(data_str)
                            if event_data.get("type") == "token":
                                full_response += event_data["content"]
                        except json.JSONDecodeError:
                            continue
        
        if not full_response:
            full_response = "I'm sorry, no response was generated."
            
        # Truncate if exceeds Telegram limits
        if len(full_response) > 4000:
            full_response = full_response[:4000] + "\n\n...[Truncated]"
            
        await status_msg.edit_text(f"**Response:**\n\n{full_response}", parse_mode="Markdown")
        
    except Exception as e:
        logger.error(f"Failed to query LLM: {e}")
        await status_msg.edit_text(f"❌ Backend communication error while querying Hermes Agent.")


def main() -> None:
    if not TOKEN:
        raise ValueError("TELEGRAM_BOT_TOKEN environment variable required. Stopping bot.")

    application = Application.builder().token(TOKEN).build()

    application.add_handler(CommandHandler("help", help_command))
    application.add_handler(CommandHandler("start", help_command))
    application.add_handler(CommandHandler("note", note_command))
    application.add_handler(CommandHandler("ask", ask_command))

    logger.info("KOCH AI Field Assistant Bot Starting...")
    application.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
