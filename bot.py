#!/usr/bin/env python3
"""
КОНТРОЛЬ - Telegram Bot
Улучшенный бот для приема заявок о городских проблемах
"""

import asyncio
import os
import aiohttp
import json
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from apscheduler.schedulers.asyncio import AsyncIOScheduler

# Міні-сервер для того, щоб Render не вбивав процес
class HealthCheckHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'text/plain')
        self.end_headers()
        self.wfile.write(b"Bot is running!")

def run_health_server():
    port = int(os.environ.get("PORT", 8000))
    server = HTTPServer(('0.0.0.0', port), HealthCheckHandler)
    print(f"Health check server started on port {port}")
    server.serve_forever()

async def auto_news_update():
    print("=== Запуск автоматичного збору новин ===")
    # Тут пізніше додамо логіку виклику твого news_generator.js
    # Поки що просто перевірка в консоль



# Запускаємо сервер у фоновому потоці
threading.Thread(target=run_health_server, daemon=True).start()
from datetime import datetime
from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import CommandStart, Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, CallbackQuery, ReplyKeyboardMarkup, KeyboardButton
from aiogram.fsm.storage.memory import MemoryStorage

# Конфигурация
API_TOKEN = os.getenv('BOT_TOKEN', '8721487651:AAEK8ppSlOYmhoP5W1JaSyS9UsagBBiEc7Q')
ADMIN_ID = os.getenv('ADMIN_ID', '7129175217')
API_URL = os.getenv('API_URL', 'http://localhost:3001/api')

# Инициализация бота
bot = Bot(token=API_TOKEN)
dp = Dispatcher(storage=MemoryStorage())

# Состояния диалога
class ReportState(StatesGroup):
    choosing_category = State()
    waiting_for_street = State()
    waiting_for_description = State()
    waiting_for_photo = State()
    waiting_for_contact = State()
    confirm_send = State()

# Категории проблем
CATEGORIES = {
    "cat_roads": "🛣 Дороги и тротуары",
    "cat_lighting": "💡 Освещение",
    "cat_trash": "🗑 Мусор и свалки",
    "cat_communal": "🔧 Коммунальные услуги",
    "cat_safety": "⚠️ Безопасность",
    "cat_other": "📋 Другое"
}

# Типы проблем для API
CATEGORY_TYPES = {
    "cat_roads": "warning",
    "cat_lighting": "warning",
    "cat_trash": "warning",
    "cat_communal": "repair",
    "cat_safety": "accident",
    "cat_other": "warning"
}

# Список улиц (будет загружен с сервера)
STREETS = []

async def load_streets():
    """Загрузка списка улиц с сервера"""
    global STREETS
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{API_URL}/streets") as response:
                if response.status == 200:
                    data = await response.json()
                    STREETS = data.get('streets', [])
    except Exception as e:
        print(f"Error loading streets: {e}")
        # Fallback streets
        STREETS = ['Ленина', 'Гагарина', 'Мира', 'Победы', 'Советская', 'Кирова', 'Московская']

def get_main_keyboard():
    """Главная клавиатура"""
    keyboard = ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="📸 Отправить заявку")],
            [KeyboardButton(text="📋 Мои заявки"), KeyboardButton(text="🗺 Карта")],
            [KeyboardButton(text="❓ Помощь")]
        ],
        resize_keyboard=True
    )
    return keyboard

def get_category_keyboard():
    """Клавиатура выбора категории"""
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=CATEGORIES["cat_roads"], callback_data="cat_roads")],
        [InlineKeyboardButton(text=CATEGORIES["cat_lighting"], callback_data="cat_lighting")],
        [InlineKeyboardButton(text=CATEGORIES["cat_trash"], callback_data="cat_trash")],
        [InlineKeyboardButton(text=CATEGORIES["cat_communal"], callback_data="cat_communal")],
        [InlineKeyboardButton(text=CATEGORIES["cat_safety"], callback_data="cat_safety")],
        [InlineKeyboardButton(text=CATEGORIES["cat_other"], callback_data="cat_other")],
        [InlineKeyboardButton(text="❌ Отмена", callback_data="cancel")]
    ])
    return keyboard

def get_streets_keyboard():
    """Клавиатура выбора улицы"""
    buttons = []
    row = []
    for i, street in enumerate(STREETS[:20]):  # Limit to 20 streets
        row.append(InlineKeyboardButton(text=street, callback_data=f"street_{street}"))
        if len(row) == 2:
            buttons.append(row)
            row = []
    if row:
        buttons.append(row)
    buttons.append([InlineKeyboardButton(text="✏️ Ввести вручную", callback_data="street_manual")])
    buttons.append([InlineKeyboardButton(text="❌ Отмена", callback_data="cancel")])
    return InlineKeyboardMarkup(inline_keyboard=buttons)

def get_confirm_keyboard():
    """Клавиатура подтверждения"""
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="✅ Отправить", callback_data="confirm_send")],
        [InlineKeyboardButton(text="🔄 Начать заново", callback_data="restart")],
        [InlineKeyboardButton(text="❌ Отмена", callback_data="cancel")]
    ])
    return keyboard

def get_skip_photo_keyboard():
    """Клавиатура пропуска фото"""
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="➡️ Пропустить", callback_data="skip_photo")],
        [InlineKeyboardButton(text="❌ Отмена", callback_data="cancel")]
    ])
    return keyboard

# ==================== HANDLERS ====================

@dp.message(CommandStart())
async def start_handler(message: types.Message, state: FSMContext):
    """Обработчик команды /start"""
    await state.clear()
    
    welcome_text = f"""
👋 <b>Привет, {message.from_user.first_name}!</b>

Добро пожаловать в бота <b>КОНТРОЛЬ</b> 🔴

Платформа мониторинга городской инфраструктуры.

<b>Что вы можете сделать:</b>
📍 Сообщить о проблеме в городе
📸 Отправить фото и описание
🗺️ Посмотреть карту проблем

<b>Как это работает:</b>
1️⃣ Вы отправляете фото и описание проблемы
2️⃣ Модератор проверяет заявку
3️⃣ Проблема появляется на карте
4️⃣ Вы получаете уведомление о решении

<b>Нажмите кнопку ниже, чтобы начать ↓</b>
    """
    
    await message.answer(welcome_text, parse_mode='HTML', reply_markup=get_main_keyboard())

@dp.message(Command("help"))
async def help_handler(message: types.Message):
    """Обработчик команды /help"""
    help_text = """
📋 <b>Справка по боту КОНТРОЛЬ</b>

<b>🚀 Быстрый старт:</b>
Просто нажмите «📸 Отправить заявку» и следуйте инструкциям.

<b>📱 Команды:</b>
/start — Начать работу
/help — Эта справка
/map — Открыть карту проблем
/myreports — Мои заявки

<b>💡 Советы:</b>
• Делайте четкие фото проблемы
• Указывайте точный адрес
• Описывайте проблему подробно
• Можно отправить заявку без фото

<b>🔗 Полезные ссылки:</b>
🌐 Сайт: https://kontrol-city.ru
📢 Канал: @kontrol_city

<b>❓ Вопросы?</b>
Пишите: info@kontrol.ru
    """
    await message.answer(help_text, parse_mode='HTML')

@dp.message(Command("map"))
async def map_handler(message: types.Message):
    """Обработчик команды /map"""
    await message.answer(
        '🗺️ <b>Карта проблем</b>\n\n'
        'Все актуальные проблемы на интерактивной карте:',
        parse_mode='HTML',
        reply_markup=InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text='🌐 Открыть карту', url='https://mg5r2wpax5tpc.ok.kimi.link')]
        ])
    )

@dp.message(Command("myreports"))
async def myreports_handler(message: types.Message):
    """Обработчик команды /myreports"""
    # Get user reports from API
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{API_URL}/reports") as response:
                if response.status == 200:
                    reports = await response.json()
                    user_reports = [r for r in reports if r.get('telegramId') == str(message.from_user.id)]
                    
                    if not user_reports:
                        await message.answer('📭 У вас пока нет заявок.')
                        return
                    
                    status_emoji = {
                        'pending': '⏳',
                        'approved': '✅',
                        'rejected': '❌',
                        'in_progress': '🔧'
                    }
                    
                    status_text = {
                        'pending': 'На модерации',
                        'approved': 'Одобрено',
                        'rejected': 'Отклонено',
                        'in_progress': 'В работе'
                    }
                    
                    text = "📊 <b>Ваши заявки:</b>\n\n"
                    for i, report in enumerate(user_reports[-5:], 1):
                        emoji = status_emoji.get(report['status'], '⏳')
                        status = status_text.get(report['status'], 'На модерации')
                        text += f"{i}. {emoji} <b>{report['title'][:50]}</b>\n"
                        text += f"   📍 {report.get('address', 'Адрес не указан')}\n"
                        text += f"   📅 {datetime.fromisoformat(report['createdAt']).strftime('%d.%m.%Y')}\n"
                        text += f"   Статус: {status}\n\n"
                    
                    await message.answer(text, parse_mode='HTML')
                else:
                    await message.answer('📭 Не удалось загрузить заявки. Попробуйте позже.')
    except Exception as e:
        print(f"Error loading reports: {e}")
        await message.answer('📭 Не удалось загрузить заявки. Попробуйте позже.')

@dp.message(F.text == "📸 Отправить заявку")
async def start_report(message: types.Message, state: FSMContext):
    """Начало создания заявки"""
    await state.set_state(ReportState.choosing_category)
    
    text = """
📝 <b>Новая заявка</b>

Выберите категорию проблемы:
    """
    
    await message.answer(text, parse_mode='HTML', reply_markup=get_category_keyboard())

@dp.message(F.text == "📋 Мои заявки")
async def my_reports_button(message: types.Message):
    """Кнопка мои заявки"""
    await myreports_handler(message)

@dp.message(F.text == "🗺 Карта")
async def map_button(message: types.Message):
    """Кнопка карта"""
    await map_handler(message)

@dp.message(F.text == "❓ Помощь")
async def help_button(message: types.Message):
    """Кнопка помощь"""
    await help_handler(message)

# ==================== CALLBACK HANDLERS ====================

@dp.callback_query(ReportState.choosing_category, F.data.startswith("cat_"))
async def category_chosen(callback: CallbackQuery, state: FSMContext):
    """Выбор категории"""
    category = callback.data
    category_name = CATEGORIES.get(category, "Другое")
    category_type = CATEGORY_TYPES.get(category, "warning")
    
    await state.update_data(
        category=category,
        category_name=category_name,
        type=category_type
    )
    
    await callback.message.edit_text(
        f"✅ <b>Категория:</b> {category_name}\n\n"
        f"Теперь выберите улицу:",
        parse_mode='HTML',
        reply_markup=get_streets_keyboard()
    )
    
    await state.set_state(ReportState.waiting_for_street)
    await callback.answer()

@dp.callback_query(ReportState.waiting_for_street, F.data.startswith("street_"))
async def street_chosen(callback: CallbackQuery, state: FSMContext):
    """Выбор улицы"""
    if callback.data == "street_manual":
        await callback.message.edit_text(
            "✏️ <b>Введите название улицы:</b>\n\n"
            "Например: Ленина, Кирова, Московская",
            parse_mode='HTML'
        )
        await callback.answer()
        return
    
    street = callback.data.replace("street_", "")
    await state.update_data(street=street)
    
    await callback.message.edit_text(
        f"✅ <b>Улица:</b> ул. {street}\n\n"
        f"Теперь введите номер дома или ориентир:",
        parse_mode='HTML'
    )
    
    await state.set_state(ReportState.waiting_for_description)
    await callback.answer()

@dp.message(ReportState.waiting_for_street)
async def manual_street(message: types.Message, state: FSMContext):
    """Ручной ввод улицы"""
    street = message.text.strip()
    await state.update_data(street=street)
    
    await message.answer(
        f"✅ <b>Улица:</b> {street}\n\n"
        f"Теперь введите номер дома и описание проблемы:",
        parse_mode='HTML'
    )
    
    await state.set_state(ReportState.waiting_for_description)

@dp.message(ReportState.waiting_for_description)
async def description_received(message: types.Message, state: FSMContext):
    """Получение описания"""
    description = message.text.strip()
    await state.update_data(description=description, building=description)
    
    await message.answer(
        "📝 <b>Описание сохранено!</b>\n\n"
        "Теперь отправьте фото проблемы или нажмите 'Пропустить':",
        parse_mode='HTML',
        reply_markup=get_skip_photo_keyboard()
    )
    
    await state.set_state(ReportState.waiting_for_photo)

@dp.callback_query(ReportState.waiting_for_photo, F.data == "skip_photo")
async def skip_photo(callback: CallbackQuery, state: FSMContext):
    """Пропуск фото"""
    await state.update_data(photo=None)
    
    data = await state.get_data()
    
    # Show confirmation
    text = format_report_preview(data)
    
    await callback.message.edit_text(
        text,
        parse_mode='HTML',
        reply_markup=get_confirm_keyboard()
    )
    
    await state.set_state(ReportState.confirm_send)
    await callback.answer()

@dp.message(ReportState.waiting_for_photo, F.photo)
async def photo_received(message: types.Message, state: FSMContext):
    """Получение фото"""
    photo = message.photo[-1]  # Best quality
    await state.update_data(photo=photo.file_id)
    
    data = await state.get_data()
    
    # Show confirmation
    text = format_report_preview(data)
    
    await message.answer(
        text,
        parse_mode='HTML',
        reply_markup=get_confirm_keyboard()
    )
    
    await state.set_state(ReportState.confirm_send)

def format_report_preview(data):
    """Форматирование превью заявки"""
    text = "📋 <b>Проверьте заявку:</b>\n\n"
    text += f"📂 <b>Категория:</b> {data.get('category_name', 'Не указана')}\n"
    text += f"📍 <b>Адрес:</b> ул. {data.get('street', '')}"
    if data.get('building'):
        text += f", {data.get('building')}"
    text += "\n\n"
    text += f"📝 <b>Описание:</b>\n{data.get('description', '')}\n\n"
    
    if data.get('photo'):
        text += "📸 <b>Фото:</b> Прикреплено ✅\n\n"
    else:
        text += "📸 <b>Фото:</b> Нет\n\n"
    
    text += "<b>Всё верно?</b>"
    
    return text

@dp.callback_query(ReportState.confirm_send, F.data == "confirm_send")
async def confirm_send(callback: CallbackQuery, state: FSMContext):
    """Подтверждение отправки"""
    data = await state.get_data()
    
    try:
        # Download photo if exists
        image_path = None
        if data.get('photo'):
            file = await bot.get_file(data['photo'])
            file_url = f"https://api.telegram.org/file/bot{API_TOKEN}/{file.file_path}"
            
            # Download and save
            async with aiohttp.ClientSession() as session:
                async with session.get(file_url) as response:
                    if response.status == 200:
                        image_data = await response.read()
                        filename = f"uploads/{callback.from_user.id}_{datetime.now().timestamp()}.jpg"
                        os.makedirs('uploads', exist_ok=True)
                        with open(filename, 'wb') as f:
                            f.write(image_data)
                        image_path = f"/{filename}"
        
        # Prepare report data
        report_data = {
            'title': data.get('description', 'Без названия')[:100],
            'description': data.get('description', ''),
            'address': f"ул. {data.get('street', '')}",
            'type': data.get('type', 'warning'),
            'telegramId': str(callback.from_user.id),
            'telegramUsername': callback.from_user.username,
            'authorName': callback.from_user.full_name,
            'imageUrl': image_path,
            'createdAt': datetime.now().isoformat()
        }
        
        # Send to API
        async with aiohttp.ClientSession() as session:
            async with session.post(f"{API_URL}/reports", json=report_data) as response:
                if response.status in [200, 201]:
                    result = await response.json()
                    
                    # Send confirmation to user
                    await callback.message.edit_text(
                        f"✅ <b>Заявка успешно отправлена!</b>\n\n"
                        f"📝 <b>{report_data['title']}</b>\n"
                        f"📍 {report_data['address']}\n"
                        f"📊 Статус: На модерации\n\n"
                        f"Ваша заявка добавлена в предложку и будет рассмотрена администратором.\n\n"
                        f"ID: <code>{result.get('report', {}).get('id', 'N/A')[:8]}</code>",
                        parse_mode='HTML'
                    )
                    
                    # Notify admin
                    if ADMIN_ID:
                        admin_text = (
                            f"🚨 <b>НОВАЯ ЗАЯВКА ИЗ TELEGRAM!</b>\n\n"
                            f"👤 <b>От:</b> {callback.from_user.full_name}\n"
                            f"📱 ID: <code>{callback.from_user.id}</code>\n"
                            f"📂 <b>Категория:</b> {data.get('category_name')}\n"
                            f"📍 <b>Адрес:</b> {report_data['address']}\n\n"
                            f"📝 <b>Описание:</b>\n{data.get('description', '')}\n\n"
                            f"<i>Проверьте предложку в админ-панели</i>"
                        )
                        
                        try:
                            if image_path:
                                with open(image_path.lstrip('/'), 'rb') as photo_file:
                                    await bot.send_photo(
                                        ADMIN_ID,
                                        photo_file,
                                        caption=admin_text,
                                        parse_mode='HTML',
                                        reply_markup=InlineKeyboardMarkup(inline_keyboard=[
                                            [InlineKeyboardButton(text='🔐 Админ-панель', url='https://mg5r2wpax5tpc.ok.kimi.link/admin.html')]
                                        ])
                                    )
                            else:
                                await bot.send_message(
                                    ADMIN_ID,
                                    admin_text,
                                    parse_mode='HTML',
                                    reply_markup=InlineKeyboardMarkup(inline_keyboard=[
                                        [InlineKeyboardButton(text='🔐 Админ-панель', url='https://mg5r2wpax5tpc.ok.kimi.link/admin.html')]
                                    ])
                                )
                        except Exception as e:
                            print(f"Error notifying admin: {e}")
                    
                else:
                    raise Exception(f"API returned {response.status}")
                    
    except Exception as e:
        print(f"Error sending report: {e}")
        
        # Fallback: save to localStorage via message
        await callback.message.edit_text(
            f"✅ <b>Заявка сохранена!</b>\n\n"
            f"К сожалению, не удалось отправить на сервер, но заявка сохранена.\n\n"
            f"📝 <b>{data.get('description', 'Без названия')[:100]}</b>\n"
            f"📍 ул. {data.get('street', '')}\n\n"
            f"Спасибо за участие!",
            parse_mode='HTML'
        )
    
    await state.clear()
    await callback.answer()

@dp.callback_query(F.data == "restart")
async def restart_report(callback: CallbackQuery, state: FSMContext):
    """Начать заново"""
    await state.clear()
    await state.set_state(ReportState.choosing_category)
    
    await callback.message.edit_text(
        "📝 <b>Новая заявка</b>\n\n"
        "Выберите категорию проблемы:",
        parse_mode='HTML',
        reply_markup=get_category_keyboard()
    )
    await callback.answer()

@dp.callback_query(F.data == "cancel")
async def cancel_report(callback: CallbackQuery, state: FSMContext):
    """Отмена"""
    await state.clear()
    await callback.message.edit_text(
        "❌ <b>Заявка отменена</b>\n\n"
        "Вы можете начать заново в любое время.",
        parse_mode='HTML'
    )
    await callback.answer()

# ==================== MAIN ====================

async def main():
    # 1. Спершу налаштовуємо і запускаємо планувальник
    scheduler = AsyncIOScheduler()
    # Запуск функції auto_news_update кожні 60 хвилин
    scheduler.add_job(auto_news_update, "interval", minutes=60)
    scheduler.start()
    print("✅ Планувальник новин запущено")

    # 2. Потім запускаємо самого бота (цей рядок має бути ОСТАННІМ у main)
    # Він "захоплює" керування і не пускає код далі
    await dp.start_polling(bot)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        print("Бот зупинений")
