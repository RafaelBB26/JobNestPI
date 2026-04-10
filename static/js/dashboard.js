document.addEventListener('DOMContentLoaded', () => {
    // Variables globales
    let userType = ''; // 'prestador' o 'cliente'
    let userData = {};
    let calendar = null;
    let currentPublicacionId = null; // Para almacenar el ID de la publicación actual

    // loader al cargar la página
    const loader = document.querySelector('.loader_p');
    if (loader) {
        setTimeout(() => {
            loader.style.opacity = '0';
            setTimeout(() => {
                loader.style.display = 'none';
                document.body.classList.remove('loader_bg');
            }, 500);
        }, 1000);
    }

    // ==================== TOASTS Y CONFIRMACIÓN ====================
    // Toast flotante
    function showToast(message, type = 'info') {
        const toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            console.warn('Contenedor de toasts no encontrado');
            return;
        }

        const toastId = 'toast-' + Date.now();
        const icon = type === 'success' ? 'bi-check-circle-fill' : 
                     type === 'error' ? 'bi-exclamation-triangle-fill' : 'bi-info-circle-fill';
        const bgClass = type === 'success' ? 'text-success' : 
                        type === 'error' ? 'text-danger' : 'text-primary';

        const toastHTML = `
            <div id="${toastId}" class="toast-custom toast" role="alert" aria-live="assertive" aria-atomic="true" data-bs-autohide="true" data-bs-delay="5000">
                <div class="toast-header">
                    <i class="bi ${icon} ${bgClass} me-2"></i>
                    <strong class="me-auto">JobNest</strong>
                    <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
                <div class="toast-body">
                    ${message}
                </div>
            </div>
        `;

        toastContainer.insertAdjacentHTML('beforeend', toastHTML);
        const toastElement = document.getElementById(toastId);
        const toast = new bootstrap.Toast(toastElement);
        toast.show();

        toastElement.addEventListener('hidden.bs.toast', () => {
            toastElement.remove();
        });
    }

    // Modal de confirmación personalizado
    function showConfirm(message, onConfirm, onCancel = null) {
        const modalElement = document.getElementById('confirmModal');
        if (!modalElement) return;

        const modal = new bootstrap.Modal(modalElement);
        const confirmBtn = document.getElementById('confirmModalConfirm');
        const cancelBtn = document.getElementById('confirmModalCancel');
        const messageEl = document.getElementById('confirmModalMessage');
        messageEl.textContent = message;

        // Eliminar listeners anteriores para evitar duplicados
        const newConfirmBtn = confirmBtn.cloneNode(true);
        const newCancelBtn = cancelBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

        newConfirmBtn.addEventListener('click', () => {
            modal.hide();
            if (onConfirm) onConfirm();
        });
        newCancelBtn.addEventListener('click', () => {
            modal.hide();
            if (onCancel) onCancel();
        });

        modal.show();
    }

    // Alias para compatibilidad (opcional)
    window.showCustomAlert = showToast;

    // ==================== INICIALIZACIÓN ====================
    async function initializeDashboard() {
        await fetchUserData();
        setupUserInterface();
        initializeEventListeners();
        loadInitialData();
        initChatbot();                  // inicializar chatbot si es cliente
    }

    // --- lógica para la carga y actualización de datos del usuario ---
    async function fetchUserData() {
        try {
            const response = await fetch('/get_user_data', { credentials: 'same-origin' });
            if (response.ok) {
                userData = await response.json();
                userType = userData.tipo_usuario || 'cliente';
                if (userData.id) {
                    sessionStorage.setItem('user_id', userData.id);
                }
                updateUIWithUserData(userData);
            } else {
                console.error('error al obtener datos del usuario:', response.statusText);
                showToast('Error al cargar los datos del usuario.', 'error');
            }
        } catch (error) {
            console.error('error de conexión al obtener datos del usuario:', error);
            showToast('Error de conexión. Por favor, inténtalo de nuevo más tarde.', 'error');
        }
    }

    function setupUserInterface() {
        const prestadorSidebar = document.getElementById('prestador-sidebar');
        const clienteSidebar = document.getElementById('cliente-sidebar');
        
        if (userType === 'prestador') {
            prestadorSidebar.classList.remove('d-none');
            showSection('inicio-prestador');
        } else {
            clienteSidebar.classList.remove('d-none');
            showSection('inicio-cliente');
        }

        document.getElementById('userTypeBadge').textContent = userType;
        document.getElementById('dropdownUserType').textContent = userType;
    }

    function updateUIWithUserData(userData) {
        const fullName = `${userData.nombres || ''} ${userData.apellido_paterno || ''} ${userData.apellido_materno || ''}`.trim();
        document.getElementById('navbarUserName').textContent = fullName || 'usuario';
        document.getElementById('dropdownUserName').textContent = fullName || 'usuario';
        document.getElementById('dropdownUserEmail').textContent = userData.correo || 'correo@ejemplo.com';

        if (userType === 'prestador') {
            document.getElementById('welcomeMessagePrestador').textContent = `¡Bienvenido/a, ${userData.nombres || 'prestador'}!`;
        } else {
            document.getElementById('welcomeMessageCliente').textContent = `¡Bienvenido/a, ${userData.nombres || 'cliente'}!`;
        }

        document.getElementById('profileName').value = userData.nombres || '';
        document.getElementById('profileLastNameP').value = userData.apellido_paterno || '';
        document.getElementById('profileLastNameM').value = userData.apellido_materno || '';
        document.getElementById('profileEmail').value = userData.correo || '';
        document.getElementById('profilePhone').value = userData.telefono || '';
    }

    // --- toggle para modo oscuro ---
    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = document.getElementById('themeIcon');
    const htmlElement = document.documentElement;

    if (themeToggle && themeIcon && htmlElement) {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            htmlElement.setAttribute('data-theme', savedTheme);
            if (savedTheme === 'dark') {
                themeIcon.classList.remove('bi-sun-fill');
                themeIcon.classList.add('bi-moon-fill');
            } else {
                themeIcon.classList.remove('bi-moon-fill');
                themeIcon.classList.add('bi-sun-fill');
            }
        } else {
            htmlElement.setAttribute('data-theme', 'light');
            themeIcon.classList.add('bi-sun-fill');
        }

        themeToggle.addEventListener('click', () => {
            if (htmlElement.getAttribute('data-theme') === 'dark') {
                htmlElement.setAttribute('data-theme', 'light');
                themeIcon.classList.remove('bi-moon-fill');
                themeIcon.classList.add('bi-sun-fill');
            } else {
                htmlElement.setAttribute('data-theme', 'dark');
                themeIcon.classList.remove('bi-sun-fill');
                themeIcon.classList.add('bi-moon-fill');
            }
            localStorage.setItem('theme', htmlElement.getAttribute('data-theme'));
        });
    }

    // --- lógica para dropdowns y efecto borroso ---
    const notificationBtn = document.getElementById('notificationBtn');
    const notificationDropdown = document.getElementById('notificationDropdown');
    const userBtn = document.getElementById('userBtn');
    const userDropdown = document.getElementById('userDropdown');
    const mainContent = document.querySelector('.main-content');
    const body = document.body;

    function applyBlurEffect(isActive) {
        if (mainContent) {
            if (isActive) {
                mainContent.classList.add('blurred-content');
                body.classList.add('overlay-active');
            } else {
                mainContent.classList.remove('blurred-content');
                body.classList.remove('overlay-active');
            }
        }
    }

    function toggleDropdown(button, dropdown) {
        const isShown = dropdown.classList.contains('show');

        if (button === notificationBtn && userDropdown.classList.contains('show')) {
            userDropdown.classList.remove('show');
            userBtn.setAttribute('aria-expanded', 'false');
        } else if (button === userBtn && notificationDropdown.classList.contains('show')) {
            notificationDropdown.classList.remove('show');
            notificationBtn.setAttribute('aria-expanded', 'false');
        }

        dropdown.classList.toggle('show');
        button.setAttribute('aria-expanded', !isShown);

        const anyDropdownOpen = notificationDropdown.classList.contains('show') || userDropdown.classList.contains('show');
        applyBlurEffect(anyDropdownOpen);

        const activeSidebar = document.querySelector('.sidebar:not(.d-none)');
        if (anyDropdownOpen && activeSidebar && activeSidebar.classList.contains('show') && window.innerWidth < 992) {
            activeSidebar.classList.remove('show');
            body.classList.remove('sidebar-open');
        }
    }

    if (notificationBtn && notificationDropdown) {
        notificationBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            toggleDropdown(notificationBtn, notificationDropdown);
        });
    }

    if (userBtn && userDropdown) {
        userBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            toggleDropdown(userBtn, userDropdown);
        });
    }

    document.addEventListener('click', (event) => {
        let dropdownOpen = false;
        if (notificationDropdown && notificationDropdown.classList.contains('show')) {
            if (!notificationDropdown.contains(event.target) && !notificationBtn.contains(event.target)) {
                notificationDropdown.classList.remove('show');
                notificationBtn.setAttribute('aria-expanded', 'false');
            } else {
                dropdownOpen = true;
            }
        }

        if (userDropdown && userDropdown.classList.contains('show')) {
            if (!userDropdown.contains(event.target) && !userBtn.contains(event.target)) {
                userDropdown.classList.remove('show');
                userBtn.setAttribute('aria-expanded', 'false');
            } else {
                dropdownOpen = true;
            }
        }

        if (!dropdownOpen) {
            applyBlurEffect(false);
        }

        const activeSidebar = document.querySelector('.sidebar:not(.d-none)');
        if (activeSidebar && activeSidebar.classList.contains('show') && window.innerWidth < 992) {
            if (!activeSidebar.contains(event.target) && !document.getElementById('sidebarToggle').contains(event.target)) {
                activeSidebar.classList.remove('show');
                body.classList.remove('sidebar-open');
            }
        }
    });

    const sidebarToggle = document.getElementById('sidebarToggle');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            const activeSidebar = document.querySelector('.sidebar:not(.d-none)');
            if (activeSidebar) {
                activeSidebar.classList.toggle('show');
                body.classList.toggle('sidebar-open');
                if (notificationDropdown) {
                    notificationDropdown.classList.remove('show');
                    notificationBtn.setAttribute('aria-expanded', 'false');
                }
                if (userDropdown) {
                    userDropdown.classList.remove('show');
                    userBtn.setAttribute('aria-expanded', 'false');
                }
                applyBlurEffect(false);
            }
        });
    }

    // --- lógica de navegación de secciones ---
    function showSection(sectionName) {
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.add('d-none');
        });

        document.querySelectorAll('.sidebar .nav-link').forEach(link => {
            link.classList.remove('active');
        });

        const targetSection = document.getElementById(sectionName + '-section');
        if (targetSection) {
            targetSection.classList.remove('d-none');
        }

        const activeSidebar = document.querySelector('.sidebar:not(.d-none)');
        if (activeSidebar) {
            const activeLink = activeSidebar.querySelector(`[data-section="${sectionName}"]`);
            if (activeLink) {
                activeLink.classList.add('active');
            }
        }

        loadSectionData(sectionName);
    }

    function initializeEventListeners() {
        // Navegación del sidebar
        const navLinks = document.querySelectorAll('.sidebar .nav-link, .btn[data-section]');
        navLinks.forEach(link => {
            link.addEventListener('click', (event) => {
                event.preventDefault();
                const targetSection = link.dataset.section;

                if (notificationDropdown) {
                    notificationDropdown.classList.remove('show');
                    notificationBtn.setAttribute('aria-expanded', 'false');
                }
                if (userDropdown) {
                    userDropdown.classList.remove('show');
                    userBtn.setAttribute('aria-expanded', 'false');
                }
                applyBlurEffect(false);

                showSection(targetSection);

                const activeSidebar = document.querySelector('.sidebar:not(.d-none)');
                if (activeSidebar && window.innerWidth < 992) {
                    activeSidebar.classList.remove('show');
                    body.classList.remove('sidebar-open');
                }
            });
        });

        // Logout
        const logoutBtn = document.getElementById('logoutBtn');
        const logoutBtnCliente = document.getElementById('logoutBtnCliente');
        const confirmLogoutBtn = document.getElementById('confirmLogout');
        let logoutModal;

        if (document.getElementById('logoutModal')) {
            logoutModal = new bootstrap.Modal(document.getElementById('logoutModal'));
        }

        function setupLogout(button) {
            if (button && logoutModal) {
                button.addEventListener('click', () => {
                    if (notificationDropdown) {
                        notificationDropdown.classList.remove('show');
                        notificationBtn.setAttribute('aria-expanded', 'false');
                    }
                    if (userDropdown) {
                        userDropdown.classList.remove('show');
                        userBtn.setAttribute('aria-expanded', 'false');
                    }
                    applyBlurEffect(false);

                    const activeSidebar = document.querySelector('.sidebar:not(.d-none)');
                    if (activeSidebar && activeSidebar.classList.contains('show') && window.innerWidth < 992) {
                        activeSidebar.classList.remove('show');
                        body.classList.remove('sidebar-open');
                    }
                    logoutModal.show();
                });
            }
        }

        setupLogout(logoutBtn);
        setupLogout(logoutBtnCliente);

        if (confirmLogoutBtn) {
            confirmLogoutBtn.addEventListener('click', () => {
                window.location.href = "/logout";
                if (logoutModal) logoutModal.hide();
            });
        }

        // Buscador principal
        const btnBuscarPrincipal = document.getElementById('btnBuscarPrincipal');
        if (btnBuscarPrincipal) {
            btnBuscarPrincipal.addEventListener('click', () => {
                const query = document.getElementById('busquedaPrincipal').value;
                const categoria = document.getElementById('categoriaPrincipal').value;
                const rangoPrecio = document.getElementById('rangoPrecio').value;
                sessionStorage.setItem('busquedaQuery', query);
                sessionStorage.setItem('busquedaCategoria', categoria);
                sessionStorage.setItem('busquedaRangoPrecio', rangoPrecio);
                showSection('buscar-servicios');
            });
        }

        // Filtros
        const aplicarFiltros = document.getElementById('aplicarFiltros');
        if (aplicarFiltros) {
            aplicarFiltros.addEventListener('click', aplicarFiltrosBusqueda);
        }

        const filtroPrecio = document.getElementById('filtroPrecio');
        if (filtroPrecio) {
            filtroPrecio.addEventListener('input', (e) => {
                document.getElementById('precioMaxLabel').textContent = `$${e.target.value}`;
            });
        }

        // Botón contactar servicio
        const contactarServicioBtn = document.getElementById('contactarServicioBtn');
        if (contactarServicioBtn) {
            contactarServicioBtn.addEventListener('click', () => {
                const servicioModal = bootstrap.Modal.getInstance(document.getElementById('servicioModal'));
                servicioModal.hide();
                const contactarModal = new bootstrap.Modal(document.getElementById('contactarServicioModal'));
                contactarModal.show();
            });
        }

        const enviarSolicitudBtn = document.getElementById('enviarSolicitudBtn');
        if (enviarSolicitudBtn) {
            enviarSolicitudBtn.addEventListener('click', enviarSolicitud);
        }
    }

    // ==================== PERFIL ====================
    const profileForm = document.getElementById('profileForm');
    const profileInputs = profileForm ? profileForm.querySelectorAll('.form-control') : [];
    const editProfileBtn = document.getElementById('editProfileBtn');
    const saveProfileBtn = document.getElementById('saveProfileBtn');
    const cancelEditProfileBtn = document.getElementById('cancelEditProfileBtn');
    const profileNameError = document.getElementById('profileNameError');
    const profileLastNamePError = document.getElementById('profileLastNamePError');
    const profileLastNameMError = document.getElementById('profileLastNameMError');
    const profilePhoneError = document.getElementById('profilePhoneError');

    function toggleProfileEditMode(enable) {
        profileInputs.forEach(input => {
            if (input.id !== 'profileEmail') {
                input.readOnly = !enable;
                if (enable) {
                    input.classList.remove('is-invalid');
                }
            }
        });
        editProfileBtn.classList.toggle('d-none', enable);
        saveProfileBtn.classList.toggle('d-none', !enable);
        cancelEditProfileBtn.classList.toggle('d-none', !enable);
        hideError(profileNameError);
        hideError(profileLastNamePError);
        hideError(profileLastNameMError);
        hideError(profilePhoneError);
    }

    toggleProfileEditMode(false);

    if (editProfileBtn) {
        editProfileBtn.addEventListener('click', () => {
            toggleProfileEditMode(true);
        });
    }

    if (cancelEditProfileBtn) {
        cancelEditProfileBtn.addEventListener('click', () => {
            toggleProfileEditMode(false);
            fetchUserData();
        });
    }

    function showError(element, message) {
        element.textContent = message;
        element.style.display = 'block';
        if (element.previousElementSibling) {
            element.previousElementSibling.classList.add('is-invalid');
        }
    }

    function hideError(element) {
        element.textContent = '';
        element.style.display = 'none';
        if (element.previousElementSibling) {
            element.previousElementSibling.classList.remove('is-invalid');
        }
    }

    function isValidNameField(name) {
        const regex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/;
        return regex.test(name);
    }

    function isValidPhone(phone) {
        const regex = /^\d{10,20}$/;
        return regex.test(phone);
    }

    if (profileForm) {
        profileForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            let isValid = true;
            hideError(profileNameError);
            hideError(profileLastNamePError);
            hideError(profileLastNameMError);
            hideError(profilePhoneError);

            const nombresInput = document.getElementById('profileName');
            if (nombresInput.value.trim() === '') {
                showError(profileNameError, 'El nombre es obligatorio.');
                isValid = false;
            } else if (!isValidNameField(nombresInput.value.trim())) {
                showError(profileNameError, 'Solo se permiten letras, espacios y acentos en el nombre.');
                isValid = false;
            }

            const lastNamePInput = document.getElementById('profileLastNameP');
            if (lastNamePInput.value.trim() === '') {
                showError(profileLastNamePError, 'El apellido paterno es obligatorio.');
                isValid = false;
            } else if (!isValidNameField(lastNamePInput.value.trim())) {
                showError(profileLastNamePError, 'Solo se permiten letras, espacios y acentos en el apellido paterno.');
                isValid = false;
            } else if (lastNamePInput.value.trim().split(' ').length > 1) {
                showError(profileLastNamePError, 'Solo se permite un apellido en este campo.');
                isValid = false;
            }

            const lastNameMInput = document.getElementById('profileLastNameM');
            if (lastNameMInput.value.trim() === '') {
                showError(profileLastNameMError, 'El apellido materno es obligatorio.');
                isValid = false;
            } else if (!isValidNameField(lastNameMInput.value.trim())) {
                showError(profileLastNameMError, 'Solo se permiten letras, espacios y acentos en el apellido materno.');
                isValid = false;
            } else if (lastNameMInput.value.trim().split(' ').length > 1) {
                showError(profileLastNameMError, 'Solo se permite un apellido en este campo.');
                isValid = false;
            }

            const phoneInput = document.getElementById('profilePhone');
            if (phoneInput.value.trim() !== '' && !isValidPhone(phoneInput.value.trim())) {
                showError(profilePhoneError, 'El número de teléfono debe contener entre 10 y 20 dígitos numéricos.');
                isValid = false;
            }

            if (!isValid) {
                showToast('Por favor, corrige los errores en tu perfil.', 'error');
                return;
            }

            const formData = new FormData(profileForm);
            try {
                const response = await fetch('/actualizar_perfil', {
                    method: 'POST',
                    body: formData,
                    credentials: 'same-origin'
                });
                const result = await response.json();
                if (response.ok) {
                    showToast(result.message, 'success');
                    fetchUserData();
                    toggleProfileEditMode(false);
                } else {
                    showToast(result.message || 'Error al actualizar el perfil.', 'error');
                }
            } catch (error) {
                console.error('error al enviar el formulario de perfil:', error);
                showToast('Error de conexión. Por favor, inténtalo de nuevo más tarde.', 'error');
            }
        });
    }

    // ==================== CAMBIAR CONTRASEÑA ====================
    const passwordChangeForm = document.getElementById('passwordChangeForm');
    const currentPasswordError = document.getElementById('currentPasswordError');
    const newPasswordError = document.getElementById('newPasswordError');
    const confirmNewPasswordError = document.getElementById('confirmNewPasswordError');

    function setupPasswordToggle(inputId, toggleBtnId) {
        const input = document.getElementById(inputId);
        const toggleBtn = document.getElementById(toggleBtnId);
        if (input && toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
                input.setAttribute('type', type);
                toggleBtn.querySelector('i').classList.toggle('bi-eye');
                toggleBtn.querySelector('i').classList.toggle('bi-eye-slash');
            });
        }
    }

    setupPasswordToggle('currentPassword', 'toggleCurrentPassword');
    setupPasswordToggle('newPassword', 'toggleNewPassword');
    setupPasswordToggle('confirmNewPassword', 'toggleConfirmNewPassword');

    function isValidPassword(password) {
        const minLength = 8;
        const hasUpperCase = /[A-Z]/.test(password);
        const hasNumber = /[0-9]/.test(password);
        const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

        if (password.length < minLength) {
            return 'La contraseña debe tener al menos 8 caracteres.';
        }
        if (!hasUpperCase) {
            return 'La contraseña debe contener al menos una letra mayúscula.';
        }
        if (!hasNumber) {
            return 'La contraseña debe contener al menos un número.';
        }
        if (!hasSpecialChar) {
            return 'La contraseña debe contener al menos un carácter especial (!@#$%^&*(),.?:{}|<>).';
        }
        return '';
    }

    if (passwordChangeForm) {
        passwordChangeForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            hideError(currentPasswordError);
            hideError(newPasswordError);
            hideError(confirmNewPasswordError);

            let isValid = true;
            const currentPassword = document.getElementById('currentPassword').value.trim();
            const newPassword = document.getElementById('newPassword').value.trim();
            const confirmNewPassword = document.getElementById('confirmNewPassword').value.trim();

            if (currentPassword === '') {
                showError(currentPasswordError, 'La contraseña actual es obligatoria.');
                isValid = false;
            }

            const newPasswordValidationResult = isValidPassword(newPassword);
            if (newPassword === '') {
                showError(newPasswordError, 'La nueva contraseña es obligatoria.');
                isValid = false;
            } else if (newPasswordValidationResult) {
                showError(newPasswordError, newPasswordValidationResult);
                isValid = false;
            }

            if (confirmNewPassword === '') {
                showError(confirmNewPasswordError, 'Confirma tu nueva contraseña.');
                isValid = false;
            } else if (newPassword !== confirmNewPassword) {
                showError(confirmNewPasswordError, 'Las contraseñas no coinciden.');
                isValid = false;
            }

            if (!isValid) {
                showToast('Por favor, corrige los errores en el formulario de cambio de contraseña.', 'error');
                return;
            }

            const formData = new FormData(passwordChangeForm);
            try {
                const response = await fetch('/cambiar_contrasena', {
                    method: 'POST',
                    body: formData,
                    credentials: 'same-origin'
                });
                const result = await response.json();
                if (response.ok) {
                    showToast(result.message, 'success');
                    passwordChangeForm.reset();
                } else {
                    showToast(result.message || 'Error al cambiar la contraseña.', 'error');
                }
            } catch (error) {
                console.error('error al enviar el formulario de cambio de contraseña:', error);
                showToast('Error de conexión. Por favor, inténtalo de nuevo más tarde.', 'error');
            }
        });
    }

    // ==================== FUNCIONALIDADES PARA PRESTADORES ====================
    function loadPrestadorData() {
        loadMisPublicaciones();
        loadEstadisticasPrestador();
        loadSolicitudesPrestador();
    }

    async function loadMisPublicaciones() {
        try {
            const response = await fetch('/mis_publicaciones', { credentials: 'same-origin' });
            const result = await response.json();
            if (response.ok && result.success) {
                const publicaciones = result.publicaciones;
                const container = document.getElementById('publicaciones-list');
                if (container) {
                    if (publicaciones.length === 0) {
                        container.innerHTML = `
                            <div class="col-12">
                                <div class="card glass-card text-center">
                                    <div class="card-body">
                                        <i class="bi bi-inbox display-4 text-muted mb-3"></i>
                                        <h5 class="card-title">No tienes publicaciones</h5>
                                        <p class="card-text">Comienza publicando tu primer servicio.</p>
                                        <button class="btn btn-primary" data-section="publicar-oficio">
                                            Publicar oficio
                                        </button>
                                    </div>
                                </div>
                            </div>
                        `;
                    } else {
                        container.innerHTML = publicaciones.map(pub => `
                            <div class="col-md-6">
                                <div class="card glass-card">
                                    <div class="card-body">
                                        <h5 class="card-title">${pub.titulo}</h5>
                                        <p class="card-text">${pub.descripcion}</p>
                                        <div class="d-flex justify-content-between align-items-center mb-2">
                                            <span class="badge bg-primary">${pub.categoria}</span>
                                            <span class="text-success fw-bold">
                                                ${pub.precio ? `$${pub.precio}` : 'Consultar precio'}
                                            </span>
                                        </div>
                                        <div class="mb-2"><small class="text-muted"><i class="bi bi-geo-alt"></i> ${pub.ubicacion}</small></div>
                                        <div class="mb-2"><small class="text-muted"><i class="bi bi-clock"></i> ${pub.disponibilidad}</small></div>
                                        <div class="mb-2"><small class="text-muted"><i class="bi bi-award"></i> ${pub.experiencia} años de experiencia</small></div>
                                        ${pub.habilidades ? `<div class="mb-2"><small class="text-muted"><i class="bi bi-tools"></i> ${pub.habilidades}</small></div>` : ''}
                                        <div class="mt-3 d-flex justify-content-between align-items-center">
                                            <span class="badge ${pub.activa ? 'bg-success' : 'bg-secondary'}">${pub.activa ? 'Activa' : 'Inactiva'}</span>
                                            <div>
                                                <button class="btn btn-primary btn-sm me-2" onclick="editarPublicacion(${pub.id})">Editar</button>
                                                <button class="btn btn-outline-${pub.activa ? 'danger' : 'success'} btn-sm" onclick="togglePublicacion(${pub.id}, ${pub.activa})">${pub.activa ? 'Desactivar' : 'Activar'}</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `).join('');
                    }
                }
            } else {
                showToast(result.message || 'Error al cargar las publicaciones.', 'error');
            }
        } catch (error) {
            console.error('Error al cargar publicaciones:', error);
            showToast('Error de conexión al cargar las publicaciones.', 'error');
        }
    }

    function loadEstadisticasPrestador() {
        document.getElementById('totalPublicaciones').textContent = '3';
        document.getElementById('solicitudesRecibidas').textContent = '12';
        document.getElementById('trabajosCompletados').textContent = '8';
        document.getElementById('calificacionPromedio').textContent = '4.8';
    }

    async function loadSolicitudesPrestador() {
        try {
            const response = await fetch('/mis_solicitudes_prestador', { credentials: 'same-origin' });
            const result = await response.json();
            if (response.ok && result.success) {
                const solicitudes = result.solicitudes;
                const container = document.getElementById('solicitudes-list');
                const badge = document.getElementById('solicitudesBadge');
                if (badge) badge.textContent = solicitudes.length;
                if (container) {
                    if (solicitudes.length === 0) {
                        container.innerHTML = `<div class="col-12"><div class="card glass-card text-center"><div class="card-body"><i class="bi bi-inbox display-4 text-muted mb-3"></i><h5 class="card-title">No tienes solicitudes</h5><p class="card-text">Cuando los clientes te envíen solicitudes, aparecerán aquí.</p></div></div></div>`;
                    } else {
                        container.innerHTML = solicitudes.map(sol => `
                            <div class="col-md-6">
                                <div class="card glass-card">
                                    <div class="card-body">
                                        <h5 class="card-title">${sol.titulo_publicacion}</h5>
                                        <p><strong>Cliente:</strong> ${sol.cliente_nombre}</p>
                                        <p><strong>Fecha solicitada:</strong> ${sol.fecha_servicio} ${sol.hora_servicio ? 'a las ' + sol.hora_servicio : ''}</p>
                                        <p><strong>Precio:</strong> $${sol.precio || 'Consultar'}</p>
                                        <p><strong>Estado:</strong> <span class="badge ${sol.estado === 'pendiente' ? 'bg-warning' : sol.estado === 'aceptada' ? 'bg-success' : 'bg-danger'}">${sol.estado}</span></p>
                                        ${sol.mensaje_cliente ? `<p><strong>Mensaje:</strong> ${sol.mensaje_cliente}</p>` : ''}
                                        <div class="mt-3">
                                            ${sol.estado === 'pendiente' ? `
                                                <button class="btn btn-success btn-sm me-2" onclick="aceptarSolicitud(${sol.id})">Aceptar</button>
                                                <button class="btn btn-danger btn-sm" onclick="rechazarSolicitud(${sol.id})">Rechazar</button>
                                            ` : `
                                                <button class="btn btn-outline-secondary btn-sm me-2" disabled>Aceptar</button>
                                                <button class="btn btn-outline-secondary btn-sm" disabled>Rechazar</button>
                                            `}
                                            ${sol.estado === 'aceptada' ? `<button class="btn btn-warning btn-sm ms-2" onclick="marcarConcluido(${sol.id})">Marcar concluido</button>` : ''}
                                            <button class="btn btn-outline-primary btn-sm ms-2" onclick="verDetallesSolicitud(${sol.id})">Detalles</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `).join('');
                    }
                }
            } else {
                showToast(result.message || 'Error al cargar las solicitudes.', 'error');
            }
        } catch (error) {
            console.error('Error al cargar solicitudes:', error);
            showToast('Error de conexión al cargar las solicitudes.', 'error');
        }
    }

    // Publicar oficio
    const publicarOficioForm = document.getElementById('publicarOficioForm');
    if (publicarOficioForm) {
        publicarOficioForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const formData = new FormData(publicarOficioForm);
            try {
                const response = await fetch('/crear_publicacion', {
                    method: 'POST',
                    body: formData,
                    credentials: 'same-origin'
                });
                const result = await response.json();
                if (response.ok && result.success) {
                    showToast(result.message, 'success');
                    publicarOficioForm.reset();
                    loadMisPublicaciones();
                    showSection('mis-publicaciones');
                } else {
                    showToast(result.message || 'Error al publicar el oficio.', 'error');
                }
            } catch (error) {
                console.error('Error al publicar oficio:', error);
                showToast('Error de conexión al publicar el oficio.', 'error');
            }
        });
    }

    // ==================== FUNCIONALIDADES PARA CLIENTES ====================
    function loadClienteData() {
        loadServiciosPopulares();
        loadCategorias();
    }

    async function loadServiciosPopulares() {
        try {
            const response = await fetch('/publicaciones_activas', { credentials: 'same-origin' });
            const result = await response.json();
            if (response.ok && result.success) {
                const servicios = result.publicaciones;
                const container = document.getElementById('servicios-populares');
                if (container) {
                    if (servicios.length === 0) {
                        container.innerHTML = `<div class="col-12"><div class="card glass-card text-center"><div class="card-body"><i class="bi bi-search display-4 text-muted mb-3"></i><h5 class="card-title">No hay servicios disponibles</h5><p class="card-text">Pronto habrá prestadores ofreciendo sus servicios.</p></div></div></div>`;
                    } else {
                        const serviciosMostrar = servicios.slice(0, 6);
                        container.innerHTML = serviciosMostrar.map(serv => `
                            <div class="col-md-4">
                                <div class="card glass-card h-100">
                                    <div class="card-body">
                                        <h5 class="card-title">${serv.titulo}</h5>
                                        <p class="text-muted">${serv.categoria}</p>
                                        <p class="small">${serv.descripcion.substring(0, 100)}...</p>
                                        <div class="d-flex justify-content-between align-items-center mb-2">
                                            <span class="text-success fw-bold">${serv.precio_texto}</span>
                                        </div>
                                        <div><small class="text-muted"><i class="bi bi-geo-alt"></i> ${serv.ubicacion}</small></div>
                                        <div><small class="text-muted"><i class="bi bi-person"></i> ${serv.prestador_nombre}</small></div>
                                        <button class="btn btn-primary btn-sm w-100 mt-2" onclick="verDetallesServicio(${serv.id})">Ver detalles</button>
                                    </div>
                                </div>
                            </div>
                        `).join('');
                    }
                }
            } else {
                showToast(result.message || 'Error al cargar los servicios.', 'error');
            }
        } catch (error) {
            console.error('Error al cargar servicios:', error);
            showToast('Error de conexión al cargar los servicios.', 'error');
        }
    }

    function loadCategorias() {
        const categorias = [
            { id: 'plomeria', nombre: 'Plomería', icono: 'bi-tools' },
            { id: 'electricidad', nombre: 'Electricidad', icono: 'bi-lightning' },
            { id: 'carpinteria', nombre: 'Carpintería', icono: 'bi-hammer' },
            { id: 'jardineria', nombre: 'Jardinería', icono: 'bi-tree' },
            { id: 'limpieza', nombre: 'Limpieza', icono: 'bi-droplet' },
            { id: 'reparaciones', nombre: 'Reparaciones', icono: 'bi-wrench' }
        ];
        const container = document.getElementById('categorias-grid');
        if (container) {
            container.innerHTML = categorias.map(cat => `
                <div class="col-md-4">
                    <div class="card glass-card h-100 text-center">
                        <div class="card-body">
                            <i class="bi ${cat.icono} display-4 text-primary mb-3"></i>
                            <h5 class="card-title">${cat.nombre}</h5>
                            <button class="btn btn-outline-primary btn-sm" onclick="filtrarPorCategoria('${cat.id}')">Explorar servicios</button>
                        </div>
                    </div>
                </div>
            `).join('');
        }
    }

    // --- BÚSQUEDA Y FILTROS ---
    async function aplicarFiltrosBusqueda() {
        try {
            const query = document.getElementById('busquedaPrincipal').value || '';
            const categoria = document.getElementById('filtroCategoria').value || '';
            const precioMax = document.getElementById('filtroPrecio').value || '';
            const experienciaMin = document.getElementById('filtroExperiencia').value || '';

            let url = `/buscar_publicaciones?q=${encodeURIComponent(query)}`;
            if (categoria) url += `&categoria=${encodeURIComponent(categoria)}`;
            if (precioMax) url += `&precio_max=${encodeURIComponent(precioMax)}`;
            if (experienciaMin) url += `&experiencia_min=${encodeURIComponent(experienciaMin)}`;

            const response = await fetch(url, { credentials: 'same-origin' });
            const result = await response.json();
            if (response.ok && result.success) {
                const publicaciones = result.publicaciones;
                const container = document.getElementById('resultados-busqueda');
                if (container) {
                    if (publicaciones.length === 0) {
                        container.innerHTML = `<div class="col-12"><div class="card glass-card text-center"><div class="card-body"><i class="bi bi-search display-4 text-muted mb-3"></i><h5 class="card-title">No se encontraron resultados</h5><p class="card-text">Intenta con otros términos de búsqueda o filtros.</p></div></div></div>`;
                    } else {
                        container.innerHTML = publicaciones.map(serv => `
                            <div class="col-md-6">
                                <div class="card glass-card h-100">
                                    <div class="card-body">
                                        <h5 class="card-title">${serv.titulo}</h5>
                                        <p class="text-muted">${serv.categoria}</p>
                                        <p>${serv.descripcion.substring(0, 150)}...</p>
                                        <div class="d-flex justify-content-between align-items-center mb-2"><span class="text-success fw-bold">${serv.precio_texto}</span></div>
                                        <div><small class="text-muted"><i class="bi bi-geo-alt"></i> ${serv.ubicacion}</small></div>
                                        <div><small class="text-muted"><i class="bi bi-award"></i> ${serv.experiencia} años de experiencia</small></div>
                                        <div><small class="text-muted"><i class="bi bi-person"></i> ${serv.prestador_nombre}</small></div>
                                        <button class="btn btn-primary btn-sm w-100 mt-2" onclick="verDetallesServicio(${serv.id})">Ver detalles</button>
                                    </div>
                                </div>
                            </div>
                        `).join('');
                    }
                }
            } else {
                showToast(result.message || 'Error al realizar la búsqueda.', 'error');
            }
        } catch (error) {
            console.error('Error al buscar:', error);
            showToast('Error de conexión al realizar la búsqueda.', 'error');
        }
    }

    // --- DETALLES DE SERVICIO ---
    async function cargarDetallesServicio(servicioId) {
        try {
            const response = await fetch(`/detalles_publicacion/${servicioId}`, { credentials: 'same-origin' });
            const result = await response.json();
            if (response.ok && result.success) {
                const servicio = result.publicacion;
                const modalBody = document.getElementById('servicioModalBody');
                const modalLabel = document.getElementById('servicioModalLabel');
                if (modalBody && modalLabel) {
                    modalLabel.textContent = servicio.titulo;
                    modalBody.innerHTML = `
                        <div class="row">
                            <div class="col-md-8">
                                <h6>Descripción del servicio</h6>
                                <p>${servicio.descripcion}</p>
                                <h6 class="mt-4">Detalles</h6>
                                <ul class="list-unstyled">
                                    <li><strong>Categoría:</strong> ${servicio.categoria}</li>
                                    <li><strong>Precio:</strong> ${servicio.precio_texto}</li>
                                    <li><strong>Ubicación:</strong> ${servicio.ubicacion}</li>
                                    <li><strong>Experiencia:</strong> ${servicio.experiencia} años</li>
                                    <li><strong>Disponibilidad:</strong> ${servicio.disponibilidad}</li>
                                    ${servicio.habilidades ? `<li><strong>Habilidades:</strong> ${servicio.habilidades}</li>` : ''}
                                    <li><strong>Incluye materiales:</strong> ${servicio.incluye_materiales ? 'Sí' : 'No'}</li>
                                </ul>
                            </div>
                            <div class="col-md-4">
                                <div class="card glass-card">
                                    <div class="card-body">
                                        <h6>Información del prestador</h6>
                                        <p><strong>Nombre:</strong> ${servicio.prestador_nombre}</p>
                                        <p><strong>Teléfono:</strong> ${servicio.prestador_telefono || 'No disponible'}</p>
                                        <p><strong>Email:</strong> ${servicio.prestador_email}</p>
                                        <p class="text-muted small">Publicado el ${servicio.fecha_creacion}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                    currentPublicacionId = servicioId;
                    const servicioModal = new bootstrap.Modal(document.getElementById('servicioModal'));
                    servicioModal.show();
                }
            } else {
                showToast(result.message || 'Error al cargar los detalles del servicio.', 'error');
            }
        } catch (error) {
            console.error('Error al cargar detalles del servicio:', error);
            showToast('Error de conexión al cargar los detalles del servicio.', 'error');
        }
    }

    // --- SOLICITUDES ---
    async function enviarSolicitud() {
        try {
            const fechaServicio = document.getElementById('fechaServicio').value;
            const horaServicio = document.getElementById('horaServicio').value;
            const mensaje = document.getElementById('mensajeSolicitud').value;
            if (!fechaServicio) {
                showToast('Por favor, selecciona una fecha para el servicio.', 'error');
                return;
            }
            const formData = new FormData();
            formData.append('publicacion_id', currentPublicacionId);
            formData.append('fecha_servicio', fechaServicio);
            formData.append('hora_servicio', horaServicio);
            formData.append('mensaje', mensaje);
            const response = await fetch('/enviar_solicitud', {
                method: 'POST',
                body: formData,
                credentials: 'same-origin'
            });
            const result = await response.json();
            if (response.ok && result.success) {
                showToast(result.message, 'success');
                const contactarModal = bootstrap.Modal.getInstance(document.getElementById('contactarServicioModal'));
                contactarModal.hide();
                document.getElementById('solicitudServicioForm').reset();
            } else {
                showToast(result.message || 'Error al enviar la solicitud.', 'error');
            }
        } catch (error) {
            console.error('Error al enviar solicitud:', error);
            showToast('Error de conexión al enviar la solicitud.', 'error');
        }
    }

    // ==================== CALENDARIO ====================
    async function recargarCalendarioConRetry(retries = 6, delayMs = 800) {
        for (let i = 0; i < retries; i++) {
            await inicializarCalendario();
            const eventos = await cargarEventosAgenda();
            if (eventos && eventos.length > 0) return true;
            await new Promise(r => setTimeout(r, delayMs));
        }
        return false;
    }

    window.inicializarCalendario = async function() {
        const calendarEl = document.getElementById('calendar-prestador');
        if (!calendarEl) {
            console.error('No se encontró el elemento con id "calendar-prestador"');
            mostrarMensajeErrorCalendario();
            return;
        }
        if (typeof FullCalendar === 'undefined') {
            console.error('FullCalendar no está cargado');
            mostrarMensajeErrorCalendario();
            return;
        }
        try {
            calendarEl.innerHTML = '';
            if (calendar) {
                calendar.destroy();
                calendar = null;
            }
            const eventos = await cargarEventosAgenda();
            calendar = new FullCalendar.Calendar(calendarEl, {
                initialView: 'dayGridMonth',
                locale: 'es',
                headerToolbar: {
                    left: 'prev,next today',
                    center: 'title',
                    right: 'dayGridMonth,timeGridWeek,timeGridDay'
                },
                events: eventos,
                selectable: false,
                editable: false,
                eventClick: (info) => mostrarDetallesEvento(info.event),
                eventDisplay: 'block',
                eventTimeFormat: { hour: '2-digit', minute: '2-digit', hour12: true }
            });
            calendar.render();
            if (eventos.length === 0) {
                mostrarMensajeCalendarioVacio();
            }
        } catch (error) {
            console.error('Error al inicializar calendario:', error);
            mostrarMensajeErrorCalendario();
        }
    }

    async function cargarEventosAgenda() {
        try {
            const response = await fetch('/obtener_eventos_agenda');
            const result = await response.json();
            if (response.ok && result.success) {
                return result.eventos;
            } else {
                console.error('Error en resultado:', result);
                showToast(result.message || 'Error al cargar la agenda.', 'error');
                return [];
            }
        } catch (error) {
            console.error('Error de conexión al cargar eventos:', error);
            showToast('Error de conexión al cargar la agenda.', 'error');
            return [];
        }
    }

    function mostrarDetallesEvento(evento) {
        const extendedProps = evento.extendedProps;
        let detallesHTML = `
            <div class="evento-detalles">
                <h5 class="text-success">${evento.title}</h5>
                <div class="row">
                    <div class="col-md-6">
                        <p><strong>Fecha del servicio:</strong> ${evento.start.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>`;
        if (evento.start instanceof Date && (evento.start.getHours() !== 0 || evento.start.getMinutes() !== 0)) {
            detallesHTML += `<p><strong>Hora:</strong> ${evento.start.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</p>`;
        }
        detallesHTML += `
                        <p><strong>Precio:</strong> ${extendedProps.precio}</p>
                        <p><strong>Aceptado el:</strong> ${extendedProps.fecha_aceptacion}</p>
                    </div>
                    <div class="col-md-6">
                        <p><strong>Cliente:</strong> ${extendedProps.cliente_nombre}</p>
                        <p><strong>Servicio:</strong> ${extendedProps.servicio}</p>`;
        if (extendedProps.descripcion && extendedProps.descripcion !== 'Sin mensaje adicional') {
            detallesHTML += `<p><strong>Mensaje del cliente:</strong> ${extendedProps.descripcion}</p>`;
        }
        detallesHTML += `</div></div></div>`;

        const servicioModalBody = document.getElementById('servicioModalBody');
        const servicioModalLabel = document.getElementById('servicioModalLabel');
        if (servicioModalBody && servicioModalLabel) {
            servicioModalLabel.textContent = 'Detalles del Trabajo Aceptado';
            servicioModalBody.innerHTML = detallesHTML;
            const contactarBtn = document.getElementById('contactarServicioBtn');
            if (contactarBtn) contactarBtn.style.display = 'none';
            const servicioModal = new bootstrap.Modal(document.getElementById('servicioModal'));
            servicioModal.show();
        } else {
            showToast(detallesHTML.replace(/<[^>]*>/g, ''), 'info');
        }
    }

    function mostrarMensajeCalendarioVacio() {
        const calendarEl = document.getElementById('calendar-prestador');
        if (calendarEl) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'calendar-status-message text-center text-muted py-5';
            emptyMessage.innerHTML = `
                <i class="bi bi-calendar-x display-4 d-block mb-3"></i>
                <h5>No tienes trabajos aceptados</h5>
                <p>Cuando aceptes solicitudes de clientes, aparecerán aquí automáticamente.</p>
                <button class="btn btn-primary mt-2" data-section="solicitudes">Ver solicitudes pendientes</button>
            `;
            emptyMessage.querySelector('button').addEventListener('click', () => showSection('solicitudes'));
            calendarEl.appendChild(emptyMessage);
        }
    }

    function mostrarMensajeErrorCalendario() {
        const calendarEl = document.getElementById('calendar-prestador');
        if (calendarEl) {
            const errorMessage = document.createElement('div');
            errorMessage.className = 'calendar-status-message text-center text-danger py-5';
            errorMessage.innerHTML = `
                <i class="bi bi-exclamation-triangle display-4 d-block mb-3"></i>
                <h5>Error al cargar la agenda</h5>
                <p>No se pudieron cargar los trabajos programados.</p>
                <div class="mt-3">
                    <button class="btn btn-outline-primary me-2" onclick="inicializarCalendario()">Reintentar</button>
                    <button class="btn btn-outline-secondary" onclick="diagnosticarAgenda()">Diagnosticar</button>
                </div>
                <div class="mt-3"><small class="text-muted">Si el problema persiste, contacta al soporte técnico.</small></div>
            `;
            calendarEl.innerHTML = '';
            calendarEl.appendChild(errorMessage);
        }
    }

    // ==================== CARGA DE DATOS POR SECCIÓN ====================
    function loadSectionData(sectionName) {
        switch (sectionName) {
            case 'inicio-prestador': loadPrestadorData(); break;
            case 'inicio-cliente': loadClienteData(); break;
            case 'agenda-prestador': inicializarCalendario(); break;
            case 'publicar-oficio': break;
            case 'mis-publicaciones': loadMisPublicaciones(); break;
            case 'solicitudes': loadSolicitudesPrestador(); break;
            case 'buscar-servicios':
                const savedQuery = sessionStorage.getItem('busquedaQuery');
                const savedCategoria = sessionStorage.getItem('busquedaCategoria');
                const savedRangoPrecio = sessionStorage.getItem('busquedaRangoPrecio');
                if (savedQuery || savedCategoria || savedRangoPrecio) {
                    document.getElementById('busquedaPrincipal').value = savedQuery || '';
                    document.getElementById('filtroCategoria').value = savedCategoria || '';
                    document.getElementById('filtroPrecio').value = savedRangoPrecio ? savedRangoPrecio.split('-')[1] || '2000' : '2000';
                    document.getElementById('precioMaxLabel').textContent = `$${document.getElementById('filtroPrecio').value}`;
                    sessionStorage.removeItem('busquedaQuery');
                    sessionStorage.removeItem('busquedaCategoria');
                    sessionStorage.removeItem('busquedaRangoPrecio');
                    aplicarFiltrosBusqueda();
                }
                break;
            case 'categorias': loadCategorias(); break;
            case 'mis-solicitudes-cliente': loadMisSolicitudesCliente(); break;
            case 'calificaciones': cargarServiciosConcluidos(); break;
            case 'mensajes': cargarConversaciones(); break;
            case 'pagos': cargarSolicitudesPago(); break;
        }
    }

    async function loadMisSolicitudesCliente() {
        try {
            const response = await fetch('/mis_solicitudes_cliente', { credentials: 'same-origin' });
            const result = await response.json();
            if (response.ok && result.success) {
                const solicitudes = result.solicitudes;
                const container = document.getElementById('mis-solicitudes-body');
                if (container) {
                    if (solicitudes.length === 0) {
                        container.innerHTML = `<tr><td colspan="6" class="text-center"><i class="bi bi-inbox display-4 text-muted"></i><p class="mt-2">No tienes solicitudes enviadas</p></td></tr>`;
                    } else {
                        container.innerHTML = solicitudes.map(sol => `
                            <tr>
                                <td>${sol.titulo_publicacion}</td>
                                <td>${sol.prestador_nombre}</td>
                                <td>${sol.fecha_solicitud}</td>
                                <td>$${sol.precio || 'Consultar'}</td>
                                <td><span class="badge ${sol.estado === 'pendiente' ? 'bg-warning' : sol.estado === 'aceptada' ? 'bg-success' : 'bg-danger'}">${sol.estado}</span></td>
                                <td><button class="btn btn-sm btn-outline-primary" onclick="verDetallesSolicitudCliente(${sol.id})">Ver detalles</button></td>
                            </tr>
                        `).join('');
                    }
                }
            } else {
                showToast(result.message || 'Error al cargar las solicitudes.', 'error');
            }
        } catch (error) {
            console.error('Error al cargar solicitudes del cliente:', error);
            showToast('Error de conexión al cargar las solicitudes.', 'error');
        }
    }

    function loadInitialData() {
        if (userType === 'prestador') {
            loadPrestadorData();
        } else {
            loadClienteData();
        }
    }

    // ==================== FUNCIONES GLOBALES ====================
    window.togglePublicacion = async function(publicacionId, estadoActual) {
        try {
            const response = await fetch(`/toggle_publicacion/${publicacionId}`, { method: 'POST', credentials: 'same-origin' });
            const result = await response.json();
            if (response.ok && result.success) {
                showToast(result.message, 'success');
                loadMisPublicaciones();
            } else {
                showToast(result.message || 'Error al cambiar el estado de la publicación.', 'error');
            }
        } catch (error) {
            console.error('Error al cambiar estado de publicación:', error);
            showToast('Error de conexión al cambiar el estado.', 'error');
        }
    };

    window.aceptarSolicitud = async function(solicitudId) {
        showConfirm('¿Estás seguro de que deseas aceptar esta solicitud? El trabajo aparecerá en tu agenda.', async () => {
            try {
                const response = await fetch(`/actualizar_estado_solicitud/${solicitudId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin',
                    body: JSON.stringify({ estado: 'aceptada' })
                });
                const result = await response.json();
                if (response.ok && result.success) {
                    showToast(result.message, 'success');
                    loadSolicitudesPrestador();
                    if (document.getElementById('agenda-prestador-section') && !document.getElementById('agenda-prestador-section').classList.contains('d-none')) {
                        recargarCalendarioConRetry(6, 800);
                    }
                } else {
                    showToast(result.message || 'Error al aceptar la solicitud.', 'error');
                }
            } catch (error) {
                console.error('Error al aceptar solicitud:', error);
                showToast('Error de conexión al aceptar la solicitud.', 'error');
            }
        });
    };

    window.rechazarSolicitud = async function(solicitudId) {
        showConfirm('¿Estás seguro de que deseas rechazar esta solicitud?', async () => {
            try {
                const response = await fetch(`/actualizar_estado_solicitud/${solicitudId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin',
                    body: JSON.stringify({ estado: 'rechazada' })
                });
                const result = await response.json();
                if (response.ok && result.success) {
                    showToast(result.message, 'success');
                    loadSolicitudesPrestador();
                } else {
                    showToast(result.message || 'Error al rechazar la solicitud.', 'error');
                }
            } catch (error) {
                console.error('Error al rechazar solicitud:', error);
                showToast('Error de conexión al rechazar la solicitud.', 'error');
            }
        });
    };

    window.editarPublicacion = async function(publicacionId) {
        try {
            const response = await fetch(`/obtener_publicacion/${publicacionId}`, { credentials: 'same-origin' });
            const result = await response.json();
            if (response.ok && result.success) {
                const publicacion = result.publicacion;
                document.getElementById('editarTitulo').value = publicacion.titulo;
                document.getElementById('editarDescripcion').value = publicacion.descripcion;
                document.getElementById('editarCategoria').value = publicacion.categoria;
                document.getElementById('editarSalario').value = publicacion.precio || '';
                document.getElementById('editarTipoPrecio').value = publicacion.tipo_precio;
                document.getElementById('editarUbicacion').value = publicacion.ubicacion;
                document.getElementById('editarExperiencia').value = publicacion.experiencia;
                document.getElementById('editarHabilidades').value = publicacion.habilidades || '';
                document.getElementById('editarDisponibilidad').value = publicacion.disponibilidad;
                document.getElementById('editarMateriales').checked = publicacion.incluye_materiales;
                document.getElementById('editarPublicacionId').value = publicacion.id;
                const editarModal = new bootstrap.Modal(document.getElementById('editarPublicacionModal'));
                editarModal.show();
            } else {
                showToast(result.message || 'Error al cargar la publicación para editar.', 'error');
            }
        } catch (error) {
            console.error('Error al cargar publicación para editar:', error);
            showToast('Error de conexión al cargar la publicación.', 'error');
        }
    };

    window.guardarEdicionPublicacion = async function() {
        const publicacionId = document.getElementById('editarPublicacionId').value;
        if (!publicacionId) {
            showToast('Error: No se encontró el ID de la publicación.', 'error');
            return;
        }
        const formData = new FormData();
        formData.append('titulo', document.getElementById('editarTitulo').value);
        formData.append('descripcion', document.getElementById('editarDescripcion').value);
        formData.append('categoria', document.getElementById('editarCategoria').value);
        formData.append('salario', document.getElementById('editarSalario').value);
        formData.append('tipo_precio', document.getElementById('editarTipoPrecio').value);
        formData.append('ubicacion', document.getElementById('editarUbicacion').value);
        formData.append('experiencia', document.getElementById('editarExperiencia').value);
        formData.append('habilidades', document.getElementById('editarHabilidades').value);
        formData.append('disponibilidad', document.getElementById('editarDisponibilidad').value);
        formData.append('incluye_materiales', document.getElementById('editarMateriales').checked ? 'on' : '');
        try {
            const response = await fetch(`/editar_publicacion/${publicacionId}`, {
                method: 'POST',
                body: formData,
                credentials: 'same-origin'
            });
            const result = await response.json();
            if (response.ok && result.success) {
                showToast(result.message, 'success');
                const editarModal = bootstrap.Modal.getInstance(document.getElementById('editarPublicacionModal'));
                editarModal.hide();
                loadMisPublicaciones();
            } else {
                showToast(result.message || 'Error al actualizar la publicación.', 'error');
            }
        } catch (error) {
            console.error('Error al actualizar publicación:', error);
            showToast('Error de conexión al actualizar la publicación.', 'error');
        }
    };

    window.verDetallesServicio = function(servicioId) {
        cargarDetallesServicio(servicioId);
    };

    window.filtrarPorCategoria = function(categoriaId) {
        showSection('buscar-servicios');
        document.getElementById('filtroCategoria').value = categoriaId;
        aplicarFiltrosBusqueda();
    };

    window.verDetallesSolicitud = function(solicitudId) {
        showToast(`Función de ver detalles de solicitud ${solicitudId} - Próximamente`, 'info');
    };

    window.verDetallesSolicitudCliente = function(solicitudId) {
        showToast(`Función de ver detalles de solicitud del cliente ${solicitudId} - Próximamente`, 'info');
    };

    // --- DIAGNÓSTICO ---
    window.diagnosticarAgenda = async function() {
        console.log('=== DIAGNÓSTICO DE AGENDA ===');
        try {
            console.log('Datos de usuario:', userData);
            console.log('Tipo de usuario:', userType);
            console.log('User ID:', userData.id || 'No disponible');
            const debugResponse = await fetch('/debug_solicitudes', { credentials: 'same-origin' });
            const debugData = await debugResponse.json();
            console.log('Datos de debug:', debugData);
            const eventos = await cargarEventosAgenda();
            console.log('Eventos del calendario:', eventos);
            showToast('Diagnóstico completado. Revisa la consola (F12) para ver los detalles.', 'info');
            return { usuario: userData, debug: debugData, eventos: eventos };
        } catch (error) {
            console.error('Error en diagnóstico:', error);
            showToast('Error en diagnóstico: ' + error.message, 'error');
            return { error: error.message };
        }
    };

    document.addEventListener('keydown', (event) => {
        if (event.ctrlKey && event.shiftKey && event.key === 'D') {
            event.preventDefault();
            diagnosticarAgenda();
        }
    });
    window.diagnosticarAgenda = diagnosticarAgenda;

    // ==================== CALIFICACIONES ====================
    async function cargarServiciosConcluidos() {
        try {
            const response = await fetch('/servicios_concluidos', { credentials: 'same-origin' });
            const result = await response.json();
            if (response.ok && result.success) {
                const container = document.getElementById('servicios-concluidos-container');
                if (container) {
                    if (result.servicios.length === 0) {
                        container.innerHTML = `<div class="col-12"><div class="card glass-card text-center p-4"><i class="bi bi-inbox display-4"></i><p class="mt-3">No hay servicios concluidos.</p></div></div>`;
                    } else {
                        container.innerHTML = result.servicios.map(serv => {
                            const yaCalifico = serv.mi_calificacion !== null;
                            const tieneCalificacionRecibida = serv.calificacion_recibida !== null;
                            let miCalificacionHTML = '';
                            if (yaCalifico) {
                                let estrellasMi = '';
                                for (let i = 1; i <= 5; i++) {
                                    estrellasMi += i <= serv.mi_calificacion ? '<i class="bi bi-star-fill text-warning"></i>' : '<i class="bi bi-star text-muted"></i>';
                                }
                                miCalificacionHTML = `<div class="mt-2"><strong>Tu calificación:</strong> ${estrellasMi}${serv.mi_comentario ? `<p class="mt-1 mb-0"><small>Comentario: ${serv.mi_comentario}</small></p>` : ''}</div>`;
                            }
                            let recibidaHTML = '';
                            if (tieneCalificacionRecibida) {
                                let estrellasRecibidas = '';
                                for (let i = 1; i <= 5; i++) {
                                    estrellasRecibidas += i <= serv.calificacion_recibida ? '<i class="bi bi-star-fill text-warning"></i>' : '<i class="bi bi-star text-muted"></i>';
                                }
                                recibidaHTML = `<div class="mt-2"><strong>Calificación recibida:</strong> ${estrellasRecibidas}${serv.comentario_recibido ? `<p class="mt-1 mb-0"><small>Comentario: ${serv.comentario_recibido}</small></p>` : ''}</div>`;
                            }
                            return `
                                <div class="col-md-6">
                                    <div class="card glass-card h-100">
                                        <div class="card-body">
                                            <h5 class="card-title">${serv.titulo}</h5>
                                            <p><strong>Con:</strong> ${serv.nombre_contratante}</p>
                                            <p><strong>Fecha:</strong> ${serv.fecha_servicio}</p>
                                            <p><strong>Precio:</strong> $${serv.precio ? serv.precio : 'Consultar'}</p>
                                            ${miCalificacionHTML}
                                            ${recibidaHTML}
                                            ${!yaCalifico ? `<button class="btn btn-primary btn-sm mt-3" onclick="abrirModalCalificar(${serv.id})">Calificar</button>` : ''}
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('');
                    }
                }
            } else {
                showToast(result.message || 'Error al cargar servicios concluidos', 'error');
            }
        } catch (error) {
            console.error('Error cargarServiciosConcluidos:', error);
            showToast('Error de conexión al cargar servicios', 'error');
        }
    }

    function abrirModalCalificar(solicitudId) {
        document.getElementById('calificarSolicitudId').value = solicitudId;
        document.getElementById('calificacionValor').value = 0;
        document.getElementById('opcionPredeterminada').value = '';
        document.getElementById('comentarioAdicional').value = '';
        const stars = document.querySelectorAll('#rating-stars i');
        stars.forEach(star => {
            star.classList.remove('bi-star-fill');
            star.classList.add('bi-star');
        });
        const modal = new bootstrap.Modal(document.getElementById('calificarModal'));
        modal.show();
    }
    window.abrirModalCalificar = abrirModalCalificar;

    async function guardarCalificacion() {
        const solicitudId = document.getElementById('calificarSolicitudId').value;
        const calificacion = document.getElementById('calificacionValor').value;
        const opcion = document.getElementById('opcionPredeterminada').value;
        const comentario = document.getElementById('comentarioAdicional').value;
        if (!solicitudId || calificacion == 0) {
            showToast('Por favor, selecciona una calificación', 'error');
            return;
        }
        try {
            const response = await fetch('/calificar_servicio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ solicitud_id: solicitudId, calificacion, opcion_predeterminada: opcion, comentario })
            });
            const result = await response.json();
            if (response.ok && result.success) {
                showToast(result.message, 'success');
                const modal = bootstrap.Modal.getInstance(document.getElementById('calificarModal'));
                modal.hide();
                cargarServiciosConcluidos();
            } else {
                showToast(result.message || 'Error al guardar calificación', 'error');
            }
        } catch (error) {
            console.error('Error guardarCalificacion:', error);
            showToast('Error de conexión', 'error');
        }
    }
    document.getElementById('guardarCalificacionBtn')?.addEventListener('click', guardarCalificacion);

    document.addEventListener('click', function(e) {
        const star = e.target.closest('#rating-stars i');
        if (star && star.dataset.rating) {
            const rating = parseInt(star.dataset.rating);
            document.getElementById('calificacionValor').value = rating;
            const stars = document.querySelectorAll('#rating-stars i');
            stars.forEach((s, idx) => {
                if (idx < rating) {
                    s.classList.remove('bi-star');
                    s.classList.add('bi-star-fill');
                } else {
                    s.classList.remove('bi-star-fill');
                    s.classList.add('bi-star');
                }
            });
        }
    });

    // ==================== MENSAJES ====================
    async function cargarConversaciones() {
    try {
        const response = await fetch('/mis_conversaciones', { credentials: 'same-origin' });
        const result = await response.json();
        if (response.ok && result.success) {
            const container = document.getElementById('lista-conversaciones');
            if (container) {
                if (result.conversaciones.length === 0) {
                    container.innerHTML = `<div class="text-center text-muted p-3">No tienes conversaciones</div>`;
                } else {
                    // Generar HTML para cada conversación
                    container.innerHTML = result.conversaciones.map(conv => {
                        // Obtener iniciales del otro usuario para el avatar
                        const initials = conv.otro_nombre.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                        return `
                            <div class="conversacion-item" data-hilo="${conv.id}" data-solicitud="${conv.solicitud_id}" data-otro="${conv.otro_nombre}">
                                <div class="conversacion-avatar">${initials}</div>
                                <div class="conversacion-info">
                                    <h6>
                                        ${conv.titulo_publicacion}
                                        <small>${conv.ultimo_enviado}</small>
                                    </h6>
                                    <p><strong>${conv.otro_nombre}</strong> ${conv.ultimo_mensaje ? conv.ultimo_mensaje.substring(0, 50) : 'Sin mensajes'}</p>
                                </div>
                            </div>
                        `;
                    }).join('');

                    // Asignar eventos click a cada conversación
                    document.querySelectorAll('.conversacion-item').forEach(item => {
                        item.addEventListener('click', (e) => {
                            e.preventDefault();
                            const hiloId = item.dataset.hilo;
                            const solicitudId = item.dataset.solicitud;
                            const otroNombre = item.dataset.otro;
                            cargarMensajes(hiloId, solicitudId, otroNombre);
                        });
                    });
                }
            }
        } else {
            showToast(result.message || 'Error al cargar conversaciones', 'error');
        }
    } catch (error) {
        console.error('Error cargarConversaciones:', error);
        showToast('Error de conexión', 'error');
    }
}

    async function cargarMensajes(hiloId, solicitudId, otroNombre) {
    try {
        const response = await fetch(`/obtener_mensajes/${hiloId}`, { credentials: 'same-origin' });
        const result = await response.json();
        if (response.ok && result.success) {
            document.getElementById('chat-header').innerHTML = `<h6>Conversación con ${otroNombre}</h6>`;
            document.getElementById('hilo-actual').value = hiloId;
            document.getElementById('solicitud-actual').value = solicitudId;
            const container = document.getElementById('mensajes-container');
            const userId = sessionStorage.getItem('user_id');
            
            container.innerHTML = result.mensajes.map(msg => {
                const esPropio = msg.emisor_id == userId;
                // Obtener inicial del nombre (primera letra)
                const inicial = msg.emisor_nombre ? msg.emisor_nombre.charAt(0).toUpperCase() : '?';
                return `
                    <div class="mensaje ${esPropio ? 'mensaje-propio' : 'mensaje-otro'}">
                        <div class="mensaje-header">
                            <div class="mensaje-avatar">${inicial}</div>
                            <div class="mensaje-nombre">${msg.emisor_nombre}</div>
                        </div>
                        <div class="mensaje-texto">${msg.cuerpo}</div>
                        <div class="mensaje-fecha">${msg.enviado_en}</div>
                    </div>
                `;
            }).join('');
            container.scrollTop = container.scrollHeight;
            document.getElementById('mensaje-texto').disabled = false;
        } else {
            showToast(result.message || 'Error al cargar mensajes', 'error');
        }
    } catch (error) {
        console.error('Error cargarMensajes:', error);
        showToast('Error de conexión', 'error');
    }
}

    const enviarMensajeForm = document.getElementById('enviar-mensaje-form');
    if (enviarMensajeForm) {
        enviarMensajeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const hiloId = document.getElementById('hilo-actual').value;
            const solicitudId = document.getElementById('solicitud-actual').value;
            const mensaje = document.getElementById('mensaje-texto').value.trim();
            if (!mensaje) return;
            const data = { mensaje };
            if (hiloId) data.hilo_id = hiloId;
            else if (solicitudId) data.solicitud_id = solicitudId;
            else {
                showToast('No hay conversación seleccionada', 'error');
                return;
            }
            try {
                const response = await fetch('/enviar_mensaje', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin',
                    body: JSON.stringify(data)
                });
                const result = await response.json();
                if (response.ok && result.success) {
                    document.getElementById('mensaje-texto').value = '';
                    if (result.hilo_id) {
                        cargarMensajes(result.hilo_id, solicitudId, '');
                    } else if (hiloId) {
                        cargarMensajes(hiloId, solicitudId, '');
                    }
                    cargarConversaciones();
                } else {
                    showToast(result.message || 'Error al enviar mensaje', 'error');
                }
            } catch (error) {
                console.error('Error enviar mensaje:', error);
                showToast('Error de conexión', 'error');
            }
        });
    }

    // ==================== PAGOS ====================
    async function cargarSolicitudesPago() {
        try {
            const response = await fetch('/obtener_solicitudes_pendientes_pago', { credentials: 'same-origin' });
            const result = await response.json();
            if (response.ok && result.success) {
                const container = document.getElementById('solicitudes-pago-container');
                if (container) {
                    if (result.solicitudes.length === 0) {
                        container.innerHTML = `<div class="col-12"><div class="card glass-card text-center p-4"><i class="bi bi-credit-card"></i><p class="mt-3">No hay pagos pendientes.</p></div></div>`;
                    } else {
                        container.innerHTML = result.solicitudes.map(sol => `
                            <div class="col-md-6">
                                <div class="card glass-card h-100">
                                    <div class="card-body">
                                        <h5 class="card-title">${sol.titulo}</h5>
                                        <p><strong>Prestador:</strong> ${sol.prestador_nombre}</p>
                                        <p><strong>Fecha servicio:</strong> ${sol.fecha_servicio}</p>
                                        <p><strong>Monto:</strong> $${sol.precio}</p>
                                        <div class="mt-3">
                                            <button class="btn btn-success me-2" onclick="procesarPago(${sol.id}, ${sol.precio}, 'efectivo')">Pagar en efectivo</button>
                                            <button class="btn btn-primary" onclick="abrirModalPagoTarjeta(${sol.id}, ${sol.precio})">Pagar con tarjeta</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `).join('');
                    }
                }
            } else {
                showToast(result.message || 'Error al cargar pagos pendientes', 'error');
            }
        } catch (error) {
            console.error('Error cargarSolicitudesPago:', error);
            showToast('Error de conexión', 'error');
        }
    }

    window.procesarPago = async function(solicitudId, monto, metodo) {
        if (metodo === 'efectivo') {
            showConfirm(`¿Confirmas el pago de $${monto} en EFECTIVO para este servicio?`, async () => {
                try {
                    const response = await fetch('/procesar_pago', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'same-origin',
                        body: JSON.stringify({ solicitud_id: solicitudId, metodo, monto })
                    });
                    const result = await response.json();
                    if (response.ok && result.success) {
                        showToast(result.message, 'success');
                        cargarSolicitudesPago();
                    } else {
                        showToast(result.message || 'Error al procesar pago', 'error');
                    }
                } catch (error) {
                    console.error('Error procesarPago:', error);
                    showToast('Error de conexión', 'error');
                }
            });
        } else {
            // tarjeta ya maneja modal aparte
        }
    };

    window.abrirModalPagoTarjeta = function(solicitudId, monto) {
        sessionStorage.setItem('montoTarjeta', monto);
        document.getElementById('pagoSolicitudId').value = solicitudId;
        document.getElementById('montoTarjetaDisplay').textContent = monto;
        document.getElementById('tarjetaNumero').value = '';
        document.getElementById('tarjetaNombre').value = '';
        document.getElementById('tarjetaExpiracion').value = '';
        document.getElementById('tarjetaCVV').value = '';
        document.getElementById('tarjetaNumeroDisplay').textContent = '**** **** **** ****';
        document.getElementById('tarjetaNombreDisplay').textContent = 'NOMBRE DEL TITULAR';
        document.getElementById('tarjetaExpiracionDisplay').textContent = 'MM/AA';
        const modal = new bootstrap.Modal(document.getElementById('pagoTarjetaModal'));
        modal.show();

        const numInput = document.getElementById('tarjetaNumero');
        const nomInput = document.getElementById('tarjetaNombre');
        const expInput = document.getElementById('tarjetaExpiracion');
        const updateTarjeta = () => {
            let numero = numInput.value.replace(/\s/g, '');
            if (numero.length > 0) {
                let formateado = numero.match(/.{1,4}/g).join(' ');
                document.getElementById('tarjetaNumeroDisplay').textContent = formateado;
            } else {
                document.getElementById('tarjetaNumeroDisplay').textContent = '**** **** **** ****';
            }
            document.getElementById('tarjetaNombreDisplay').textContent = nomInput.value.toUpperCase() || 'NOMBRE DEL TITULAR';
            document.getElementById('tarjetaExpiracionDisplay').textContent = expInput.value || 'MM/AA';
        };
        numInput.addEventListener('input', updateTarjeta);
        nomInput.addEventListener('input', updateTarjeta);
        expInput.addEventListener('input', updateTarjeta);
    };

    document.getElementById('confirmarPagoTarjetaBtn')?.addEventListener('click', async () => {
        const solicitudId = document.getElementById('pagoSolicitudId').value;
        const numero = document.getElementById('tarjetaNumero').value.trim();
        const nombre = document.getElementById('tarjetaNombre').value.trim();
        const expiracion = document.getElementById('tarjetaExpiracion').value.trim();
        const cvv = document.getElementById('tarjetaCVV').value.trim();
        const montoPasado = sessionStorage.getItem('montoTarjeta');
        if (!montoPasado) return;
        if (!numero || !nombre || !expiracion || !cvv) {
            showToast('Completa todos los campos de la tarjeta (número, titular, fecha y CVV)', 'error');
            return;
        }
        try {
            const response = await fetch('/procesar_pago', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({
                    solicitud_id: solicitudId,
                    metodo: 'tarjeta',
                    monto: parseFloat(montoPasado),
                    numero,
                    nombre,
                    expiracion,
                    cvv
                })
            });
            const result = await response.json();
            if (response.ok && result.success) {
                showToast(result.message, 'success');
                const modal = bootstrap.Modal.getInstance(document.getElementById('pagoTarjetaModal'));
                modal.hide();
                cargarSolicitudesPago();
            } else {
                showToast(result.message || 'Error en el pago', 'error');
            }
        } catch (error) {
            console.error('Error pago tarjeta:', error);
            showToast('Error de conexión', 'error');
        }
    });

    // ==================== MARCAR CONCLUIDO ====================
    window.marcarConcluido = async function(solicitudId) {
        showConfirm('¿Estás seguro de que deseas marcar este trabajo como concluido? Una vez marcado, el cliente podrá calificarlo.', async () => {
            try {
                const response = await fetch(`/marcar_concluido/${solicitudId}`, {
                    method: 'POST',
                    credentials: 'same-origin'
                });
                const result = await response.json();
                if (response.ok && result.success) {
                    showToast(result.message, 'success');
                    loadSolicitudesPrestador();
                    if (document.getElementById('agenda-prestador-section') && !document.getElementById('agenda-prestador-section').classList.contains('d-none')) {
                        inicializarCalendario();
                    }
                } else {
                    showToast(result.message || 'Error al marcar como concluido.', 'error');
                }
            } catch (error) {
                console.error('Error al marcar como concluido:', error);
                showToast('Error de conexión al marcar como concluido.', 'error');
            }
        });
    };

    // ==================== CHATBOT ====================
    function initChatbot() {
        if (userType !== 'cliente') return;
        const chatIcon = document.getElementById('open-chatbot');
        const chatContainer = document.getElementById('chatbot-container');
        if (!chatIcon || !chatContainer) return;

        chatIcon.classList.remove('d-none');
        chatContainer.classList.remove('d-none');
        chatContainer.style.display = 'none';

        chatIcon.addEventListener('click', () => {
            chatContainer.style.display = (chatContainer.style.display === 'none') ? 'flex' : 'none';
        });
        document.getElementById('close-chatbot').addEventListener('click', () => {
            chatContainer.style.display = 'none';
        });

        const sendBtn = document.getElementById('send-chatbot');
        const input = document.getElementById('chatbot-input');
        const messagesContainer = document.getElementById('chatbot-messages');

        function addMessage(text, isUser) {
            const div = document.createElement('div');
            div.className = `message ${isUser ? 'user' : 'bot'}`;
            div.innerHTML = text.replace(/\n/g, '<br>');
            messagesContainer.appendChild(div);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        async function sendMessage() {
            const text = input.value.trim();
            if (!text) return;
            addMessage(text, true);
            input.value = '';
            try {
                const response = await fetch('/chatbot', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin',
                    body: JSON.stringify({ mensaje: text })
                });
                const result = await response.json();
                if (response.ok && result.success) {
                    addMessage(result.respuesta, false);
                } else {
                    addMessage('Lo siento, hubo un error. Intenta de nuevo.', false);
                }
            } catch (error) {
                console.error(error);
                addMessage('Error de conexión. Intenta más tarde.', false);
            }
        }

        sendBtn.addEventListener('click', sendMessage);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });

        document.querySelectorAll('.suggestion-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                input.value = btn.innerText;
                sendMessage();
            });
        });
    }

    // Ajustes de ventana
    window.addEventListener('resize', () => {
        if (window.innerWidth >= 992) {
            const activeSidebar = document.querySelector('.sidebar:not(.d-none)');
            if (activeSidebar) {
                activeSidebar.classList.remove('show');
            }
            body.classList.remove('sidebar-open');
        }
    });

    // Iniciar todo
    initializeDashboard();
});