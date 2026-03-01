/**
 * News Generator - City Control
 * Simple template engine for news generation
 */

const NewsEngine = (function() {
    'use strict';

    const TEMPLATES = {
        accident: [
            { title: 'Прорыв трубы на {street}', text: 'В результате прорыва магистральной трубы затоплена проезжая часть. Движение перекрыто, работают аварийные бригады.' },
            { title: 'Обрушение асфальта образовало яму', text: 'На проезжей части образовалась опасная яма после проливных дождей. Движение транспорта затруднено.' },
            { title: 'Авария на теплотрассе', text: 'Произошёл разрыв тепломагистрали. Аварийные службы локализовали утечку, ремонт продлится до вечера.' },
            { title: 'Провал грунта у остановки', text: 'Опасный провал диаметром 3 метра образовался у остановки. Пешеходы вынуждены выходить на проезжую часть.' },
            { title: 'Открытый люк на дороге', text: 'Канализационный люк без крышки представляет опасность для автомобилистов. Местные жители установили предупреждение.' }
        ],
        warning: [
            { title: 'Трещина в асфальте угрожает безопасности', text: 'На тротуаре образовалась глубокая трещина длиной около 10 метров. Местные жители опасаются обрушения.' },
            { title: 'Отсутствие освещения создаёт опасность', text: 'Фонари не работают более месяца. Жители боятся выходить в тёмное время суток.' },
            { title: 'Разрушающийся мост требует ремонта', text: 'Пешеходный мост в аварийном состоянии: ржавые перила, дыры в настиле. Обещали ремонт в прошлом году.' },
            { title: 'Заброшенная стройплощадка', text: 'Незавершённый объект огорожен ржавым забором. Территория заросла бурьяном, скопился мусор.' },
            { title: 'Просевшая дорога превратилась в "волну"', text: 'Асфальт деформировался от проезда тяжёлой техники. Водители вынуждены снижать скорость.' }
        ],
        repair: [
            { title: 'Начался капитальный ремонт дороги', text: 'На участке длиной 2 километра полностью заменят асфальт и коммуникации. Движение ограничено.' },
            { title: 'Замена водопроводных сетей', text: 'Аварийные трубы будут заменены на полимерные. В некоторых домах возможно отключение воды.' },
            { title: 'Реконструкция теплотрассы завершена', text: 'Модернизация магистрали позволит избежать зимних аварий. Новые трубы рассчитаны на 50 лет.' },
            { title: 'Благоустройство сквера', text: 'Установлены новые скамейки, фонари и детская площадка. Высажены молодые деревья и кустарники.' },
            { title: 'Ремонт лифтов в домах', text: 'Заменены устаревшие подъёмники на современные. Новые лифты оснащены системами безопасности.' }
        ]
    };

    const STREETS = ['Ленина', 'Гагарина', 'Мира', 'Победы', 'Советская', 'Кирова', 'Московская'];

    function getTypeLabel(type) {
        const labels = {
            accident: 'Авария',
            warning: 'Предупреждение',
            repair: 'Ремонт'
        };
        return labels[type] || type;
    }

    function generateNews(type) {
        const types = ['accident', 'warning', 'repair'];
        const selectedType = type || types[Math.floor(Math.random() * types.length)];
        const templates = TEMPLATES[selectedType];
        const template = templates[Math.floor(Math.random() * templates.length)];
        
        const street = STREETS[Math.floor(Math.random() * STREETS.length)];
        const title = template.title.replace('{street}', street);
        const hoursAgo = Math.floor(Math.random() * 72);
        const timestamp = new Date(Date.now() - hoursAgo * 3600000);

        return {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
            type: selectedType,
            title: title,
            text: template.text,
            author: DataLayer.getRandomAuthor(),
            timestamp: timestamp.toISOString(),
            address: DataLayer.generateAddress(),
            imageUrl: DataLayer.getRandomImage(selectedType),
            lat: 55.7558 + (Math.random() - 0.5) * 0.1,
            lng: 37.6173 + (Math.random() - 0.5) * 0.2
        };
    }

    function generateBatch(count, type) {
        const news = [];
        for (let i = 0; i < count; i++) {
            news.push(generateNews(type));
        }
        return news;
    }

    return {
        generateNews,
        generateBatch,
        getTypeLabel
    };
})();

window.NewsEngine = NewsEngine;
