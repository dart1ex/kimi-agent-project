/**
 * App Controller - City Control
 * One-page application with smooth scroll
 */

const app = (function() {
    'use strict';

    let currentUser = null;
    let feedFilter = 'all';
    let feedOffset = 0;
    const FEED_LIMIT = 6;
    let selectedFile = null;

    // API URL
    const API_URL = window.location.hostname === 'localhost' 
        ? 'http://localhost:3001/api' 
        : 'https://kimi-api.onrender.com/api';

    // ==================== INIT ====================

    function init() {
        currentUser = DataLayer.getCurrentUser();
        updateAuthUI();
        initCitySelector();
        MapModule.init();
        loadFeed();
        updateStats();
        setupNav();
        setupScrollSpy();
        setupArticleModal();
        loadStreets();
    }

    function setupNav() {
        // Close mobile menu on resize
        window.addEventListener('resize', () => {
            if (window.innerWidth > 1024) {
                document.getElementById('mobileMenu').classList.remove('active');
                document.querySelector('.menu-toggle').classList.remove('active');
            }
        });
    }

    function setupScrollSpy() {
        const sections = document.querySelectorAll('section[id]');
        const navLinks = document.querySelectorAll('.nav-link');

        const observerOptions = {
            root: null,
            rootMargin: '-50% 0px -50% 0px',
            threshold: 0
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const id = entry.target.getAttribute('id');
                    navLinks.forEach(link => {
                        link.classList.remove('active');
                        if (link.getAttribute('href') === '#' + id) {
                            link.classList.add('active');
                        }
                    });
                }
            });
        }, observerOptions);

        sections.forEach(section => observer.observe(section));
    }

    // ==================== CITY SELECTOR ====================

    function initCitySelector() {
        const wrapper = document.getElementById('citySelectorWrapper');
        const display = document.getElementById('citySelectorDisplay');
        const dropdown = document.getElementById('cityDropdown');
        
        if (!wrapper || !display || !dropdown) return;

        const cities = DataLayer.getCities();
        const currentCity = DataLayer.getCurrentCity();
        const cityOptions = dropdown.querySelectorAll('.city-option');

        // Update display with current city
        display.textContent = cities[currentCity]?.name || 'Москва';

        // Toggle dropdown
        wrapper.addEventListener('click', (e) => {
            e.stopPropagation();
            wrapper.classList.toggle('active');
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', () => {
            wrapper.classList.remove('active');
        });

        dropdown.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // Handle city selection
        cityOptions.forEach(option => {
            option.addEventListener('click', () => {
                const cityId = option.dataset.value;
                const cityName = option.textContent.trim();
                
                if (cityId !== DataLayer.getCurrentCity()) {
                    // Update active state
                    cityOptions.forEach(opt => opt.classList.remove('active'));
                    option.classList.add('active');
                    
                    // Update display
                    display.textContent = cityName;
                    
                    // Change city
                    changeCity(cityId);
                }
                
                wrapper.classList.remove('active');
            });
        });

        // Update display
        updateCityDisplay();
    }

    function changeCity(cityId) {
        const cities = DataLayer.getCities();
        const city = cities[cityId];
        
        if (!city) return;

        // Show notification
        showNotification(`Загрузка данных для ${city.name}...`);

        // Regenerate data for new city
        DataLayer.regenerateForCity(cityId);

        // Update map
        MapModule.changeCity(city);

        // Reload feed
        loadFeed(true);

        // Update stats
        updateStats();

        // Update display
        updateCityDisplay();
        
        // Update streets
        loadStreets();

        showNotification(`Город изменён на ${city.name}`);
    }

    function updateCityDisplay() {
        const cities = DataLayer.getCities();
        const currentCity = DataLayer.getCurrentCity();
        const cityName = cities[currentCity]?.name || 'Москва';
        
        // Update hero badge
        const cityNameEl = document.getElementById('currentCityName');
        if (cityNameEl) {
            cityNameEl.textContent = cityName;
        }
        
        // Update map section title
        const mapCityNameEl = document.getElementById('mapCityName');
        if (mapCityNameEl) {
            // Get correct preposition for city name
            const preposition = getCityPreposition(currentCity);
            mapCityNameEl.textContent = preposition + ' ' + cityName;
        }
        
        // Update city selector display
        const selectorDisplay = document.getElementById('citySelectorDisplay');
        if (selectorDisplay) {
            selectorDisplay.textContent = cityName;
        }
    }
    
    function getCityPreposition(cityId) {
        // Returns correct preposition for city name (в/во)
        const citiesWithVo = ['spb']; // Saint Petersburg
        return citiesWithVo.includes(cityId) ? 'во' : 'в';
    }

    // ==================== STREETS ====================

    function loadStreets() {
        const currentCity = DataLayer.getCurrentCity();
        const locations = DataLayer.getCityLocations(currentCity);
        const streets = locations.streets;
        
        const streetSelects = document.querySelectorAll('#problemStreet, #quickStreet');
        streetSelects.forEach(select => {
            if (!select) return;
            const currentValue = select.value;
            select.innerHTML = '<option value="">Выберите улицу</option>';
            streets.forEach(street => {
                const option = document.createElement('option');
                option.value = street;
                option.textContent = 'ул. ' + street;
                select.appendChild(option);
            });
            select.value = currentValue;
        });
    }

    // ==================== SCROLL ====================

    function scrollTo(id) {
        const element = document.getElementById(id);
        if (!element) return;

        const navHeight = document.getElementById('nav').offsetHeight;
        const targetPosition = element.offsetTop - navHeight;
        
        window.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
        });
    }

    // ==================== THEME ====================

    function toggleTheme() {
        const current = DataLayer.getTheme();
        const next = current === 'dark' ? 'light' : 'dark';
        DataLayer.setTheme(next);
        MapModule.onThemeChange();
        showNotification('Тема изменена');
    }

    // ==================== MENU ====================

    function toggleMenu() {
        const menu = document.getElementById('mobileMenu');
        const toggle = document.querySelector('.menu-toggle');
        menu.classList.toggle('active');
        toggle.classList.toggle('active');
    }

    // ==================== AUTH ====================

    function openAuth() {
        document.getElementById('authModal').classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeAuth() {
        document.getElementById('authModal').classList.remove('active');
        document.body.style.overflow = '';
    }

    function switchAuthTab(tab) {
        document.querySelectorAll('.auth-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.tab === tab);
        });
        
        if (tab === 'login') {
            document.getElementById('loginForm').classList.remove('hidden');
            document.getElementById('registerForm').classList.add('hidden');
        } else {
            document.getElementById('loginForm').classList.add('hidden');
            document.getElementById('registerForm').classList.remove('hidden');
        }
    }

    function login(e) {
        e.preventDefault();
        
        const login = document.getElementById('loginLogin').value.trim();
        const password = document.getElementById('loginPassword').value;

        const user = DataLayer.findUser(login, password);
        
        if (!user) {
            showNotification('Неверный логин или пароль', 'error');
            return;
        }

        currentUser = user;
        DataLayer.setCurrentUser(user);
        updateAuthUI();
        closeAuth();
        showNotification('Добро пожаловать, ' + user.name + '!');
        
        document.getElementById('loginLogin').value = '';
        document.getElementById('loginPassword').value = '';
    }

    function register(e) {
        e.preventDefault();
        
        const name = document.getElementById('regName').value.trim();
        const email = document.getElementById('regEmail').value.trim();
        const password = document.getElementById('regPassword').value;

        if (DataLayer.getUserByLogin(email)) {
            showNotification('Пользователь с таким email уже существует', 'error');
            return;
        }

        const user = DataLayer.saveUser({
            name: name,
            login: email,
            email: email,
            password: password,
            role: 'user'
        });

        currentUser = user;
        DataLayer.setCurrentUser(user);
        updateAuthUI();
        closeAuth();
        showNotification('Регистрация успешна!');
        
        document.getElementById('regName').value = '';
        document.getElementById('regEmail').value = '';
        document.getElementById('regPassword').value = '';
    }

    function logout() {
        currentUser = null;
        DataLayer.setCurrentUser(null);
        updateAuthUI();
        showNotification('Вы вышли из системы');
    }

    function updateAuthUI() {
        const authBox = document.getElementById('authBox');
        const userBox = document.getElementById('userBox');
        const userName = document.getElementById('userName');
        const adminBadge = document.getElementById('adminBadgeNav');
        const adminLink = document.getElementById('adminLink');

        if (currentUser) {
            authBox.classList.add('hidden');
            userBox.classList.remove('hidden');
            userName.textContent = currentUser.name;
            
            // Show admin elements if user is admin
            const isAdmin = currentUser.role === 'admin';
            if (adminBadge) {
                adminBadge.classList.toggle('hidden', !isAdmin);
            }
            if (adminLink) {
                adminLink.classList.toggle('hidden', !isAdmin);
            }
        } else {
            authBox.classList.remove('hidden');
            userBox.classList.add('hidden');
            if (adminBadge) adminBadge.classList.add('hidden');
            if (adminLink) adminLink.classList.add('hidden');
        }
    }

    // ==================== PROBLEM FORM ====================

    function openProblemForm() {
        document.getElementById('problemFormModal').classList.add('active');
        document.body.style.overflow = 'hidden';
        loadStreets();
    }

    function closeProblemForm() {
        document.getElementById('problemFormModal').classList.remove('active');
        document.body.style.overflow = '';
        selectedFile = null;
        document.getElementById('problemForm').reset();
        resetFileUpload('filePreview', 'fileUpload');
    }

    function handleFileSelect(input, previewId, uploadId) {
        const file = input.files[0];
        if (!file) return;

        selectedFile = file;

        // Show preview
        const preview = document.getElementById(previewId);
        const upload = document.getElementById(uploadId);
        
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
                preview.style.display = 'block';
                upload.classList.add('has-file');
            };
            reader.readAsDataURL(file);
        }
    }

    function resetFileUpload(previewId, uploadId) {
        const preview = document.getElementById(previewId);
        const upload = document.getElementById(uploadId);
        if (preview) {
            preview.innerHTML = '';
            preview.style.display = 'none';
        }
        if (upload) {
            upload.classList.remove('has-file');
        }
    }

    async function submitProblem(e) {
        e.preventDefault();
        
        const name = document.getElementById('problemName').value.trim();
        const street = document.getElementById('problemStreet').value;
        const building = document.getElementById('problemBuilding').value.trim();
        const type = document.getElementById('problemType').value;
        const description = document.getElementById('problemDescription').value.trim();
        const fileInput = document.getElementById('problemFile');
        
        if (!street) {
            showNotification('Пожалуйста, выберите улицу', 'error');
            return;
        }

        // Build address
        const address = building ? `ул. ${street}, ${building}` : `ул. ${street}`;
        
        // Create form data
        const formData = new FormData();
        formData.append('title', description.split('\n')[0].substring(0, 100));
        formData.append('description', description);
        formData.append('address', address);
        formData.append('type', type);
        formData.append('authorName', name);
        
        if (fileInput.files[0]) {
            formData.append('image', fileInput.files[0]);
        }

        try {
            showNotification('Отправка заявки...');
            
            const response = await fetch(`${API_URL}/reports`, {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                closeProblemForm();
                showSuccessModal();
                showNotification('Заявка успешно отправлена!', 'success');
            } else {
                throw new Error('Failed to submit');
            }
        } catch (error) {
            // Fallback: save to localStorage
            const suggestions = JSON.parse(localStorage.getItem('kontrol_suggestions') || '[]');
            suggestions.push({
                id: Date.now().toString(36) + Math.random().toString(36).substr(2),
                source: 'website',
                authorName: name,
                title: description.split('\n')[0].substring(0, 100),
                description: description,
                address: address,
                type: type,
                imageUrl: null,
                createdAt: new Date().toISOString(),
                read: false
            });
            localStorage.setItem('kontrol_suggestions', JSON.stringify(suggestions));
            
            closeProblemForm();
            showSuccessModal();
            showNotification('Заявка сохранена локально', 'success');
        }
    }

    async function submitQuickReport(e) {
        e.preventDefault();
        
        const name = document.getElementById('quickName').value.trim();
        const street = document.getElementById('quickStreet').value;
        const building = document.getElementById('quickBuilding').value.trim();
        const type = document.getElementById('quickType').value;
        const description = document.getElementById('quickDescription').value.trim();
        const fileInput = document.getElementById('quickFile');
        
        if (!street) {
            showNotification('Пожалуйста, выберите улицу', 'error');
            return;
        }

        // Build address
        const address = building ? `ул. ${street}, ${building}` : `ул. ${street}`;
        
        // Create form data
        const formData = new FormData();
        formData.append('title', description.split('\n')[0].substring(0, 100));
        formData.append('description', description);
        formData.append('address', address);
        formData.append('type', type);
        formData.append('authorName', name);
        
        if (fileInput.files[0]) {
            formData.append('image', fileInput.files[0]);
        }

        try {
            showNotification('Отправка заявки...');
            
            const response = await fetch(`${API_URL}/reports`, {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                document.getElementById('quickReportForm').reset();
                resetFileUpload('quickFilePreview', 'quickFileUpload');
                showSuccessModal();
                showNotification('Заявка успешно отправлена!', 'success');
            } else {
                throw new Error('Failed to submit');
            }
        } catch (error) {
            // Fallback: save to localStorage
            const suggestions = JSON.parse(localStorage.getItem('kontrol_suggestions') || '[]');
            suggestions.push({
                id: Date.now().toString(36) + Math.random().toString(36).substr(2),
                source: 'website',
                authorName: name,
                title: description.split('\n')[0].substring(0, 100),
                description: description,
                address: address,
                type: type,
                imageUrl: null,
                createdAt: new Date().toISOString(),
                read: false
            });
            localStorage.setItem('kontrol_suggestions', JSON.stringify(suggestions));
            
            document.getElementById('quickReportForm').reset();
            resetFileUpload('quickFilePreview', 'quickFileUpload');
            showSuccessModal();
            showNotification('Заявка сохранена локально', 'success');
        }
    }

    function showSuccessModal() {
        document.getElementById('successModal').classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeSuccessModal() {
        document.getElementById('successModal').classList.remove('active');
        document.body.style.overflow = '';
    }

    // ==================== ARTICLE MODAL ====================

    function setupArticleModal() {
        // Close modal on overlay click
        const modal = document.getElementById('articleModal');
        if (modal) {
            modal.querySelector('.modal-overlay').addEventListener('click', closeArticleModal);
        }
    }

    function openArticleModal(articleId) {
        const articles = DataLayer.getArticles();
        const article = articles.find(a => a.id === articleId);
        
        if (!article) return;

        const modal = document.getElementById('articleModal');
        const content = modal.querySelector('.article-modal-body');
        
        const typeLabels = {
            accident: 'Авария',
            warning: 'Предупреждение',
            repair: 'Ремонт'
        };

        const typeColors = {
            accident: '#ff3333',
            warning: '#ffc107',
            repair: '#28a745'
        };

        content.innerHTML = `
            <div class="article-modal-image">
                <img src="${article.imageUrl}" alt="${article.title}" onerror="this.src='https://via.placeholder.com/800x400/222/444?text=Нет+фото'">
                <span class="article-modal-type" style="background: ${typeColors[article.type]}">${typeLabels[article.type]}</span>
            </div>
            <div class="article-modal-content">
                <h2 class="article-modal-title">${article.title}</h2>
                <div class="article-modal-meta">
                    <span class="article-modal-date">${DataLayer.formatDate(article.timestamp)}</span>
                    <span class="article-modal-city">${article.cityName || 'Город'}</span>
                    <span class="article-modal-address">${article.address}</span>
                </div>
                <div class="article-modal-text">
                    ${article.fullContent ? article.fullContent.replace(/\n/g, '<br>') : article.text}
                </div>
                <div class="article-modal-footer">
                    <div class="article-modal-author">
                        <span class="author-label">Сообщил:</span>
                        <span class="author-name">${article.author}</span>
                    </div>
                    <button class="btn btn-telegram" onclick="window.open('https://t.me/kontrol_city_bot', '_blank')">
                        <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                        </svg>
                        Обсудить в Telegram
                    </button>
                </div>
            </div>
        `;

        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeArticleModal() {
        const modal = document.getElementById('articleModal');
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }

    // ==================== FEED ====================

    function loadFeed(reset) {
        if (reset) {
            feedOffset = 0;
            document.getElementById('feedGrid').innerHTML = '';
        }

        let articles = DataLayer.getArticles();
        
        if (feedFilter !== 'all') {
            articles = articles.filter(a => a.type === feedFilter);
        }

        articles.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        const toShow = articles.slice(feedOffset, feedOffset + FEED_LIMIT);
        const grid = document.getElementById('feedGrid');

        toShow.forEach(article => {
            grid.appendChild(createCard(article));
        });

        feedOffset += toShow.length;

        const loadMoreBtn = document.getElementById('loadMoreBtn');
        if (loadMoreBtn) {
            loadMoreBtn.style.display = feedOffset < articles.length ? 'inline-flex' : 'none';
        }
    }

    function createCard(article) {
        const card = document.createElement('div');
        card.className = 'news-card';
        card.onclick = () => openArticleModal(article.id);

        const typeLabels = {
            accident: 'Авария',
            warning: 'Предупреждение',
            repair: 'Ремонт'
        };

        card.innerHTML = `
            <img class="news-card-image" src="${article.imageUrl}" alt="" loading="lazy" 
                onerror="this.src='https://via.placeholder.com/800x600/222/444?text=Нет+фото'">
            <div class="news-card-content">
                <div class="news-card-header">
                    <span class="news-card-type ${article.type}">${typeLabels[article.type]}</span>
                    <span class="news-card-date">${DataLayer.formatDate(article.timestamp)}</span>
                </div>
                <h3 class="news-card-title">${article.title}</h3>
                <p class="news-card-text">${article.text}</p>
                <div class="news-card-footer">
                    <span class="news-card-author">${article.author}</span>
                    <span class="news-card-location">${article.address.split(',')[0]}</span>
                </div>
                <div class="news-card-readmore">Нажмите, чтобы прочитать полностью →</div>
            </div>
        `;

        return card;
    }

    function filterFeed(type) {
        feedFilter = type;
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === type);
        });
        loadFeed(true);
    }

    function loadMore() {
        loadFeed();
    }

    // ==================== STATS ====================

    function updateStats() {
        const stats = DataLayer.getStats();
        const markersEl = document.getElementById('statMarkers');
        const articlesEl = document.getElementById('statArticles');
        const usersEl = document.getElementById('statUsers');

        if (markersEl) markersEl.textContent = stats.markers;
        if (articlesEl) articlesEl.textContent = stats.articles;
        if (usersEl) usersEl.textContent = stats.users;
    }

    // ==================== CONTACT ====================

    function handleContact(e) {
        e.preventDefault();
        
        const name = document.getElementById('contactName').value.trim();
        const email = document.getElementById('contactEmail').value.trim();
        const message = document.getElementById('contactMessage').value.trim();
        
        if (!name || !email || !message) {
            showNotification('Пожалуйста, заполните все поля', 'error');
            return;
        }
        
        // Create contact message object
        const contactMessage = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2),
            name: name,
            email: email,
            message: message,
            createdAt: new Date().toISOString(),
            status: 'unread'
        };
        
        // Save to localStorage (in production this would go to backend)
        let messages = JSON.parse(localStorage.getItem('kontrol_contact_messages') || '[]');
        messages.push(contactMessage);
        localStorage.setItem('kontrol_contact_messages', JSON.stringify(messages));
        
        // Also save to admin notifications
        let adminNotifications = JSON.parse(localStorage.getItem('kontrol_admin_notifications') || '[]');
        adminNotifications.push({
            type: 'contact',
            title: 'Новое сообщение от ' + name,
            message: message.substring(0, 100) + (message.length > 100 ? '...' : ''),
            timestamp: new Date().toISOString(),
            read: false,
            data: contactMessage
        });
        localStorage.setItem('kontrol_admin_notifications', JSON.stringify(adminNotifications));
        
        showNotification('Сообщение отправлено! Администратор получит уведомление.', 'success');
        document.getElementById('contactForm').reset();
    }

    // ==================== NOTIFICATION ====================

    function showNotification(text, type) {
        const notif = document.getElementById('notification');
        const textEl = notif.querySelector('.notification-text');
        
        textEl.textContent = text;
        notif.className = 'notification' + (type ? ' ' + type : '');
        
        // Force reflow
        void notif.offsetWidth;
        
        notif.classList.add('active');
        
        setTimeout(() => {
            notif.classList.remove('active');
        }, 3000);
    }

    // ==================== PUBLIC API ====================

    return {
        init,
        scrollTo,
        toggleTheme,
        toggleMenu,
        openAuth,
        closeAuth,
        switchAuthTab,
        login,
        register,
        logout,
        filterFeed,
        loadMore,
        handleContact,
        openArticleModal,
        closeArticleModal,
        changeCity,
        openProblemForm,
        closeProblemForm,
        handleFileSelect,
        submitProblem,
        submitQuickReport,
        showSuccessModal,
        closeSuccessModal,
        loadStreets
    };
})();

// Initialize
document.addEventListener('DOMContentLoaded', app.init);
window.app = app;
