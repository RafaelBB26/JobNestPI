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

    // Detectar tipo de usuario y cargar interfaz correspondiente
    async function initializeDashboard() {
        await fetchUserData();
        setupUserInterface();
        initializeEventListeners();
        loadInitialData();
    }

    // --- lógica para la carga y actualización de datos del usuario ---
    async function fetchUserData() {
        try {
            const response = await fetch('/get_user_data', {
                credentials: 'same-origin'
            });
            if (response.ok) {
                userData = await response.json();
                console.log('datos del usuario recibidos:', userData);
                
                // Determinar tipo de usuario
                userType = userData.tipo_usuario || 'cliente';
                
                updateUIWithUserData(userData);
            } else {
                console.error('error al obtener datos del usuario:', response.statusText);
                showCustomAlert('Error al cargar los datos del usuario.');
            }
        } catch (error) {
            console.error('error de conexión al obtener datos del usuario:', error);
            showCustomAlert('Error de conexión. por favor, inténtalo de nuevo más tarde.');
        }
    }

    function setupUserInterface() {
        // Mostrar sidebar correspondiente al tipo de usuario
        const prestadorSidebar = document.getElementById('prestador-sidebar');
        const clienteSidebar = document.getElementById('cliente-sidebar');
        
        if (userType === 'prestador') {
            prestadorSidebar.classList.remove('d-none');
            showSection('inicio-prestador');
        } else {
            clienteSidebar.classList.remove('d-none');
            showSection('inicio-cliente');
        }

        // Actualizar badges de tipo de usuario
        document.getElementById('userTypeBadge').textContent = userType;
        document.getElementById('dropdownUserType').textContent = userType;
    }

    function updateUIWithUserData(userData) {
        // actualizar navbar y dropdown de usuario
        const fullName = `${userData.nombres || ''} ${userData.apellido_paterno || ''} ${userData.apellido_materno || ''}`.trim();
        document.getElementById('navbarUserName').textContent = fullName || 'usuario';
        document.getElementById('dropdownUserName').textContent = fullName || 'usuario';
        document.getElementById('dropdownUserEmail').textContent = userData.correo || 'correo@ejemplo.com';

        // actualizar mensajes de bienvenida según el tipo de usuario
        if (userType === 'prestador') {
            document.getElementById('welcomeMessagePrestador').textContent = `¡Bienvenido/a, ${userData.nombres || 'prestador'}!`;
        } else {
            document.getElementById('welcomeMessageCliente').textContent = `¡Bienvenido/a, ${userData.nombres || 'cliente'}!`;
        }

        // actualizar campos del formulario de perfil
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

        // cierra otros dropdowns si están abiertos
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

        // cierra el sidebar si está abierto en pantallas pequeñas al abrir un dropdown
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

    // cerrar dropdowns y quitar el desenfoque al hacer clic fuera
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

        // cierra sidebar si se hace clic fuera en pantallas pequeñas
        const activeSidebar = document.querySelector('.sidebar:not(.d-none)');
        if (activeSidebar && activeSidebar.classList.contains('show') && window.innerWidth < 992) {
            if (!activeSidebar.contains(event.target) && !document.getElementById('sidebarToggle').contains(event.target)) {
                activeSidebar.classList.remove('show');
                body.classList.remove('sidebar-open');
            }
        }
    });

    // --- lógica del botón de hamburguesa para el sidebar responsivo ---
    const sidebarToggle = document.getElementById('sidebarToggle');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            const activeSidebar = document.querySelector('.sidebar:not(.d-none)');
            if (activeSidebar) {
                activeSidebar.classList.toggle('show');
                body.classList.toggle('sidebar-open');
                
                // cierra dropdowns abiertos al desplegar sidebar
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
        // Ocultar todas las secciones
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.add('d-none');
        });

        // Remover 'active' de todos los enlaces
        document.querySelectorAll('.sidebar .nav-link').forEach(link => {
            link.classList.remove('active');
        });

        // Mostrar sección seleccionada
        const targetSection = document.getElementById(sectionName + '-section');
        if (targetSection) {
            targetSection.classList.remove('d-none');
        }

        // Activar enlace correspondiente
        const activeSidebar = document.querySelector('.sidebar:not(.d-none)');
        if (activeSidebar) {
            const activeLink = activeSidebar.querySelector(`[data-section="${sectionName}"]`);
            if (activeLink) {
                activeLink.classList.add('active');
            }
        }

        // Cargar datos específicos de la sección
        loadSectionData(sectionName);
    }

    function initializeEventListeners() {
        // Navegación del sidebar
        const navLinks = document.querySelectorAll('.sidebar .nav-link, .btn[data-section]');
        navLinks.forEach(link => {
            link.addEventListener('click', (event) => {
                event.preventDefault();
                const targetSection = link.dataset.section;

                // cierra dropdowns y sidebar
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

                // cierra el sidebar en pantallas pequeñas
                const activeSidebar = document.querySelector('.sidebar:not(.d-none)');
                if (activeSidebar && window.innerWidth < 992) {
                    activeSidebar.classList.remove('show');
                    body.classList.remove('sidebar-open');
                }
            });
        });

        // Logout buttons
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
                    // cierra dropdowns y sidebar
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

        // Buscador principal para clientes
        const btnBuscarPrincipal = document.getElementById('btnBuscarPrincipal');
        if (btnBuscarPrincipal) {
            btnBuscarPrincipal.addEventListener('click', () => {
                // Obtener los valores de búsqueda y redirigir a la sección de búsqueda
                const query = document.getElementById('busquedaPrincipal').value;
                const categoria = document.getElementById('categoriaPrincipal').value;
                const rangoPrecio = document.getElementById('rangoPrecio').value;

                // Almacenar los filtros para usarlos en la búsqueda
                sessionStorage.setItem('busquedaQuery', query);
                sessionStorage.setItem('busquedaCategoria', categoria);
                sessionStorage.setItem('busquedaRangoPrecio', rangoPrecio);

                showSection('buscar-servicios');
            });
        }

        // Filtros de búsqueda
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

        // Botón de contactar servicio en el modal de detalles
        const contactarServicioBtn = document.getElementById('contactarServicioBtn');
        if (contactarServicioBtn) {
            contactarServicioBtn.addEventListener('click', () => {
                // Cerrar el modal de detalles y abrir el modal de solicitud
                const servicioModal = bootstrap.Modal.getInstance(document.getElementById('servicioModal'));
                servicioModal.hide();

                const contactarModal = new bootstrap.Modal(document.getElementById('contactarServicioModal'));
                contactarModal.show();
            });
        }

        // Botón para enviar solicitud
        const enviarSolicitudBtn = document.getElementById('enviarSolicitudBtn');
        if (enviarSolicitudBtn) {
            enviarSolicitudBtn.addEventListener('click', enviarSolicitud);
        }
    }

    // --- lógica para la actualización del perfil ---
    const profileForm = document.getElementById('profileForm');
    const profileInputs = profileForm ? profileForm.querySelectorAll('.form-control') : [];
    const editProfileBtn = document.getElementById('editProfileBtn');
    const saveProfileBtn = document.getElementById('saveProfileBtn');
    const cancelEditProfileBtn = document.getElementById('cancelEditProfileBtn');

    // elementos de error para el formulario de perfil
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

    // inicializar en modo de solo lectura
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
            if (phoneInput.value.trim() === '') {
                // Teléfono opcional
            } else if (!isValidPhone(phoneInput.value.trim())) {
                showError(profilePhoneError, 'El número de teléfono debe contener entre 10 y 20 dígitos numéricos.');
                isValid = false;
            }

            if (!isValid) {
                showCustomAlert('Por favor, corrige los errores en tu perfil.');
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
                    showCustomAlert(result.message);
                    fetchUserData();
                    toggleProfileEditMode(false);
                } else {
                    showCustomAlert(result.message || 'Error al actualizar el perfil.');
                }
            } catch (error) {
                console.error('error al enviar el formulario de perfil:', error);
                showCustomAlert('Error de conexión. por favor, inténtalo de nuevo más tarde.');
            }
        });
    }

    // --- lógica para cambiar contraseña ---
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
                showCustomAlert('Por favor, corrige los errores en el formulario de cambio de contraseña.');
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
                    showCustomAlert(result.message);
                    passwordChangeForm.reset();
                } else {
                    showCustomAlert(result.message || 'Error al cambiar la contraseña.');
                }
            } catch (error) {
                console.error('error al enviar el formulario de cambio de contraseña:', error);
                showCustomAlert('Error de conexión. por favor, inténtalo de nuevo más tarde.');
            }
        });
    }

    // --- FUNCIONALIDADES PARA PRESTADORES ---
    function loadPrestadorData() {
        // Cargar publicaciones del prestador
        loadMisPublicaciones();
        
        // Cargar estadísticas
        loadEstadisticasPrestador();
        
        // Cargar solicitudes
        loadSolicitudesPrestador();
    }

    async function loadMisPublicaciones() {
        try {
            const response = await fetch('/mis_publicaciones', {
                credentials: 'same-origin'
            });
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
                                        <div class="mb-2">
                                            <small class="text-muted">
                                                <i class="bi bi-geo-alt"></i> ${pub.ubicacion}
                                            </small>
                                        </div>
                                        <div class="mb-2">
                                            <small class="text-muted">
                                                <i class="bi bi-clock"></i> ${pub.disponibilidad}
                                            </small>
                                        </div>
                                        <div class="mb-2">
                                            <small class="text-muted">
                                                <i class="bi bi-award"></i> ${pub.experiencia} años de experiencia
                                            </small>
                                        </div>
                                        ${pub.habilidades ? `
                                        <div class="mb-2">
                                            <small class="text-muted">
                                                <i class="bi bi-tools"></i> ${pub.habilidades}
                                            </small>
                                        </div>
                                        ` : ''}
                                        <div class="mt-3 d-flex justify-content-between align-items-center">
                                            <span class="badge ${pub.activa ? 'bg-success' : 'bg-secondary'}">
                                                ${pub.activa ? 'Activa' : 'Inactiva'}
                                            </span>
                                            <div>
                                                <button class="btn btn-primary btn-sm me-2" onclick="editarPublicacion(${pub.id})">
                                                    Editar
                                                </button>
                                                <button class="btn btn-outline-${pub.activa ? 'danger' : 'success'} btn-sm" 
                                                        onclick="togglePublicacion(${pub.id}, ${pub.activa})">
                                                    ${pub.activa ? 'Desactivar' : 'Activar'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `).join('');
                    }
                }
            } else {
                showCustomAlert(result.message || 'Error al cargar las publicaciones.');
            }
        } catch (error) {
            console.error('Error al cargar publicaciones:', error);
            showCustomAlert('Error de conexión al cargar las publicaciones.');
        }
    }

    function loadEstadisticasPrestador() {
        // Simulación de estadísticas
        document.getElementById('totalPublicaciones').textContent = '3';
        document.getElementById('solicitudesRecibidas').textContent = '12';
        document.getElementById('trabajosCompletados').textContent = '8';
        document.getElementById('calificacionPromedio').textContent = '4.8';
    }

    async function loadSolicitudesPrestador() {
        try {
            const response = await fetch('/mis_solicitudes_prestador', {
                credentials: 'same-origin'
            });
            const result = await response.json();
            
            if (response.ok && result.success) {
                const solicitudes = result.solicitudes;
                const container = document.getElementById('solicitudes-list');
                const badge = document.getElementById('solicitudesBadge');
                
                if (badge) {
                    badge.textContent = solicitudes.length;
                }
                
                if (container) {
                    if (solicitudes.length === 0) {
                        container.innerHTML = `
                            <div class="col-12">
                                <div class="card glass-card text-center">
                                    <div class="card-body">
                                        <i class="bi bi-inbox display-4 text-muted mb-3"></i>
                                        <h5 class="card-title">No tienes solicitudes</h5>
                                        <p class="card-text">Cuando los clientes te envíen solicitudes, aparecerán aquí.</p>
                                    </div>
                                </div>
                            </div>
                        `;
                    } else {
                        container.innerHTML = solicitudes.map(sol => `
                            <div class="col-md-6">
                                <div class="card glass-card">
                                    <div class="card-body">
                                        <h5 class="card-title">${sol.titulo_publicacion}</h5>
                                        <p class="card-text"><strong>Cliente:</strong> ${sol.cliente_nombre}</p>
                                        <p class="card-text"><strong>Fecha solicitada:</strong> ${sol.fecha_servicio} ${sol.hora_servicio ? 'a las ' + sol.hora_servicio : ''}</p>
                                        <p class="card-text"><strong>Precio:</strong> $${sol.precio || 'Consultar'}</p>
                                        <p class="card-text"><strong>Estado:</strong> 
                                            <span class="badge ${sol.estado === 'pendiente' ? 'bg-warning' : sol.estado === 'aceptada' ? 'bg-success' : 'bg-danger'}">
                                                ${sol.estado}
                                            </span>
                                        </p>
                                        ${sol.mensaje_cliente ? `<p class="card-text"><strong>Mensaje:</strong> ${sol.mensaje_cliente}</p>` : ''}
                                        <div class="mt-3">
                                            ${sol.estado === 'pendiente' ? `
                                                <button class="btn btn-success btn-sm me-2" onclick="aceptarSolicitud(${sol.id})">Aceptar</button>
                                                <button class="btn btn-danger btn-sm" onclick="rechazarSolicitud(${sol.id})">Rechazar</button>
                                            ` : `
                                                <button class="btn btn-outline-secondary btn-sm me-2" disabled>Aceptar</button>
                                                <button class="btn btn-outline-secondary btn-sm" disabled>Rechazar</button>
                                            `}
                                            <button class="btn btn-outline-primary btn-sm ms-2" onclick="verDetallesSolicitud(${sol.id})">Detalles</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `).join('');
                    }
                }
            } else {
                showCustomAlert(result.message || 'Error al cargar las solicitudes.');
            }
        } catch (error) {
            console.error('Error al cargar solicitudes:', error);
            showCustomAlert('Error de conexión al cargar las solicitudes.');
        }
    }

    // Formulario para publicar oficio
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
                    showCustomAlert(result.message);
                    publicarOficioForm.reset();
                    // Recargar la lista de publicaciones
                    loadMisPublicaciones();
                    // Regresar a la sección de mis publicaciones
                    showSection('mis-publicaciones');
                } else {
                    showCustomAlert(result.message || 'Error al publicar el oficio.');
                }
            } catch (error) {
                console.error('Error al publicar oficio:', error);
                showCustomAlert('Error de conexión al publicar el oficio.');
            }
        });
    }

    // --- FUNCIONALIDADES PARA CLIENTES ---
    function loadClienteData() {
        loadServiciosPopulares();
        loadCategorias();
    }

    async function loadServiciosPopulares() {
        try {
            const response = await fetch('/publicaciones_activas', {
                credentials: 'same-origin'
            });
            const result = await response.json();
            
            if (response.ok && result.success) {
                const servicios = result.publicaciones;
                const container = document.getElementById('servicios-populares');
                
                if (container) {
                    if (servicios.length === 0) {
                        container.innerHTML = `
                            <div class="col-12">
                                <div class="card glass-card text-center">
                                    <div class="card-body">
                                        <i class="bi bi-search display-4 text-muted mb-3"></i>
                                        <h5 class="card-title">No hay servicios disponibles</h5>
                                        <p class="card-text">Pronto habrá prestadores ofreciendo sus servicios.</p>
                                    </div>
                                </div>
                            </div>
                        `;
                    } else {
                        // Mostrar solo los primeros 6 servicios
                        const serviciosMostrar = servicios.slice(0, 6);
                        container.innerHTML = serviciosMostrar.map(serv => `
                            <div class="col-md-4">
                                <div class="card glass-card h-100">
                                    <div class="card-body">
                                        <h5 class="card-title">${serv.titulo}</h5>
                                        <p class="card-text text-muted">${serv.categoria}</p>
                                        <p class="card-text small">${serv.descripcion.substring(0, 100)}...</p>
                                        <div class="d-flex justify-content-between align-items-center mb-2">
                                            <span class="text-success fw-bold">${serv.precio_texto}</span>
                                        </div>
                                        <div class="mb-2">
                                            <small class="text-muted">
                                                <i class="bi bi-geo-alt"></i> ${serv.ubicacion}
                                            </small>
                                        </div>
                                        <div class="mb-2">
                                            <small class="text-muted">
                                                <i class="bi bi-person"></i> ${serv.prestador_nombre}
                                            </small>
                                        </div>
                                        <button class="btn btn-primary btn-sm w-100 mt-2" onclick="verDetallesServicio(${serv.id})">
                                            Ver detalles
                                        </button>
                                    </div>
                                </div>
                            </div>
                        `).join('');
                    }
                }
            } else {
                showCustomAlert(result.message || 'Error al cargar los servicios.');
            }
        } catch (error) {
            console.error('Error al cargar servicios:', error);
            showCustomAlert('Error de conexión al cargar los servicios.');
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
                            <button class="btn btn-outline-primary btn-sm" onclick="filtrarPorCategoria('${cat.id}')">
                                Explorar servicios
                            </button>
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

            // Construir URL de búsqueda
            let url = `/buscar_publicaciones?q=${encodeURIComponent(query)}`;
            if (categoria) url += `&categoria=${encodeURIComponent(categoria)}`;
            if (precioMax) url += `&precio_max=${encodeURIComponent(precioMax)}`;
            if (experienciaMin) url += `&experiencia_min=${encodeURIComponent(experienciaMin)}`;

            const response = await fetch(url, {
                credentials: 'same-origin'
            });
            const result = await response.json();

            if (response.ok && result.success) {
                const publicaciones = result.publicaciones;
                const container = document.getElementById('resultados-busqueda');

                if (container) {
                    if (publicaciones.length === 0) {
                        container.innerHTML = `
                            <div class="col-12">
                                <div class="card glass-card text-center">
                                    <div class="card-body">
                                        <i class="bi bi-search display-4 text-muted mb-3"></i>
                                        <h5 class="card-title">No se encontraron resultados</h5>
                                        <p class="card-text">Intenta con otros términos de búsqueda o filtros.</p>
                                    </div>
                                </div>
                            </div>
                        `;
                    } else {
                        container.innerHTML = publicaciones.map(serv => `
                            <div class="col-md-6">
                                <div class="card glass-card h-100">
                                    <div class="card-body">
                                        <h5 class="card-title">${serv.titulo}</h5>
                                        <p class="card-text text-muted">${serv.categoria}</p>
                                        <p class="card-text">${serv.descripcion.substring(0, 150)}...</p>
                                        <div class="d-flex justify-content-between align-items-center mb-2">
                                            <span class="text-success fw-bold">${serv.precio_texto}</span>
                                        </div>
                                        <div class="mb-2">
                                            <small class="text-muted">
                                                <i class="bi bi-geo-alt"></i> ${serv.ubicacion}
                                            </small>
                                        </div>
                                        <div class="mb-2">
                                            <small class="text-muted">
                                                <i class="bi bi-award"></i> ${serv.experiencia} años de experiencia
                                            </small>
                                        </div>
                                        <div class="mb-2">
                                            <small class="text-muted">
                                                <i class="bi bi-person"></i> ${serv.prestador_nombre}
                                            </small>
                                        </div>
                                        <button class="btn btn-primary btn-sm w-100 mt-2" onclick="verDetallesServicio(${serv.id})">
                                            Ver detalles
                                        </button>
                                    </div>
                                </div>
                            </div>
                        `).join('');
                    }
                }
            } else {
                showCustomAlert(result.message || 'Error al realizar la búsqueda.');
            }
        } catch (error) {
            console.error('Error al buscar:', error);
            showCustomAlert('Error de conexión al realizar la búsqueda.');
        }
    }

    // --- DETALLES DE SERVICIO ---
    async function cargarDetallesServicio(servicioId) {
        try {
            const response = await fetch(`/detalles_publicacion/${servicioId}`, {
                credentials: 'same-origin'
            });
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

                    // Guardar el ID de la publicación actual para la solicitud
                    currentPublicacionId = servicioId;
                    
                    // Mostrar el modal
                    const servicioModal = new bootstrap.Modal(document.getElementById('servicioModal'));
                    servicioModal.show();
                }
            } else {
                showCustomAlert(result.message || 'Error al cargar los detalles del servicio.');
            }
        } catch (error) {
            console.error('Error al cargar detalles del servicio:', error);
            showCustomAlert('Error de conexión al cargar los detalles del servicio.');
        }
    }

    // --- SOLICITUDES ---
    async function enviarSolicitud() {
        try {
            const fechaServicio = document.getElementById('fechaServicio').value;
            const horaServicio = document.getElementById('horaServicio').value;
            const mensaje = document.getElementById('mensajeSolicitud').value;

            if (!fechaServicio) {
                showCustomAlert('Por favor, selecciona una fecha para el servicio.');
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
                showCustomAlert(result.message);
                // Cerrar el modal de solicitud
                const contactarModal = bootstrap.Modal.getInstance(document.getElementById('contactarServicioModal'));
                contactarModal.hide();
                // Limpiar el formulario
                document.getElementById('solicitudServicioForm').reset();
            } else {
                showCustomAlert(result.message || 'Error al enviar la solicitud.');
            }
        } catch (error) {
            console.error('Error al enviar solicitud:', error);
            showCustomAlert('Error de conexión al enviar la solicitud.');
        }
    }

    // --- FUNCIÓN HELPER PARA REINTENTOS DEL CALENDARIO ---
    async function recargarCalendarioConRetry(retries = 6, delayMs = 800) {
        for (let i = 0; i < retries; i++) {
            await inicializarCalendario();
            const eventos = await cargarEventosAgenda();
            if (eventos && eventos.length > 0) return true;
            await new Promise(r => setTimeout(r, delayMs));
        }
        return false;
    }

    // --- CALENDARIO MEJORADO - FUNCIÓN GLOBAL ---
window.inicializarCalendario = async function() {
    console.log('🔍 Buscando elemento del calendario...');
    const calendarEl = document.getElementById('calendar-prestador');
    
    if (!calendarEl) {
        console.error('❌ No se encontró el elemento con id "calendar-prestador"');
        mostrarMensajeErrorCalendario();
        return;
    }
    
    if (typeof FullCalendar === 'undefined') {
        console.error('❌ FullCalendar no está cargado');
        mostrarMensajeErrorCalendario();
        return;
    }

    console.log('✅ Elemento del calendario y FullCalendar encontrados');
    
    try {
        // Limpiar el contenedor primero
        calendarEl.innerHTML = '';
        
        // Destruir calendario existente
        if (calendar) {
            calendar.destroy();
            calendar = null;
        }

        console.log('🔄 Inicializando calendario...');
        const eventos = await cargarEventosAgenda();
        console.log('📅 Eventos cargados para calendario:', eventos);
        
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
            eventClick: function(info) {
                mostrarDetallesEvento(info.event);
            },
            eventDisplay: 'block',
            eventTimeFormat: {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            },
            eventDidMount: function(info) {
                console.log('✅ Evento montado en calendario:', info.event.title);
            }
        });
        
        calendar.render();
        console.log('🎉 Calendario renderizado correctamente');

        // Mostrar mensaje si no hay eventos
        if (eventos.length === 0) {
            mostrarMensajeCalendarioVacio();
        }
        
    } catch (error) {
        console.error('❌ Error al inicializar calendario:', error);
        mostrarMensajeErrorCalendario();
    }
}

    async function cargarEventosAgenda() {
        try {
            console.log('Solicitando eventos de agenda al servidor...');
            const response = await fetch('/obtener_eventos_agenda');
            console.log('Respuesta HTTP obtener_eventos_agenda:', response.status, response.statusText);
            const result = await response.json();
            console.log('Respuesta JSON de obtener_eventos_agenda:', result);

            if (response.ok && result.success) {
                console.log(`Se cargaron ${result.eventos.length} trabajos aceptados`);
                // imprimir cada evento recibido
                result.eventos.forEach((e,i) => console.log(`evento[${i}] start=${e.start} end=${e.end} allDay=${e.allDay}`));
                return result.eventos;
            } else {
                console.error('Error en resultado:', result);
                showCustomAlert(result.message || 'Error al cargar la agenda: no se obtuvieron eventos.');
                return [];
            }
        } catch (error) {
            console.error('Error de conexión al cargar eventos:', error);
            showCustomAlert('Error de conexión al cargar la agenda: ' + error.message);
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
                        <p><strong>Fecha del servicio:</strong> ${evento.start.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        `;
        
        if (evento.start instanceof Date && (evento.start.getHours() !== 0 || evento.start.getMinutes() !== 0)) {
            detallesHTML += `<p><strong>Hora:</strong> ${evento.start.toLocaleTimeString('es-ES', {hour: '2-digit', minute:'2-digit'})}</p>`;
        }
        
        detallesHTML += `
                        <p><strong>Precio:</strong> ${extendedProps.precio}</p>
                        <p><strong>Aceptado el:</strong> ${extendedProps.fecha_aceptacion}</p>
                    </div>
                    <div class="col-md-6">
                        <p><strong>Cliente:</strong> ${extendedProps.cliente_nombre}</p>
                        <p><strong>Servicio:</strong> ${extendedProps.servicio}</p>
        `;
        
        if (extendedProps.descripcion && extendedProps.descripcion !== 'Sin mensaje adicional') {
            detallesHTML += `<p><strong>Mensaje del cliente:</strong> ${extendedProps.descripcion}</p>`;
        }
        
        detallesHTML += `
                    </div>
                </div>
            </div>
        `;
        
        // Usar el modal de detalles existente
        const servicioModalBody = document.getElementById('servicioModalBody');
        const servicioModalLabel = document.getElementById('servicioModalLabel');
        
        if (servicioModalBody && servicioModalLabel) {
            servicioModalLabel.textContent = 'Detalles del Trabajo Aceptado';
            servicioModalBody.innerHTML = detallesHTML;
            
            // Ocultar botones que no son necesarios para eventos de agenda
            const contactarBtn = document.getElementById('contactarServicioBtn');
            if (contactarBtn) contactarBtn.style.display = 'none';
            
            const servicioModal = new bootstrap.Modal(document.getElementById('servicioModal'));
            servicioModal.show();
        } else {
            // Fallback: mostrar alerta personalizada
            showCustomAlert(detallesHTML.replace(/<[^>]*>/g, ''));
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
                <button class="btn btn-primary mt-2" data-section="solicitudes">
                    Ver solicitudes pendientes
                </button>
            `;
            
            // Agregar evento al botón
            emptyMessage.querySelector('button').addEventListener('click', function() {
                showSection('solicitudes');
            });
            
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
                    <button class="btn btn-outline-primary me-2" onclick="inicializarCalendario()">
                        <i class="bi bi-arrow-clockwise"></i> Reintentar
                    </button>
                    <button class="btn btn-outline-secondary" onclick="diagnosticarAgenda()">
                        <i class="bi bi-tools"></i> Diagnosticar
                    </button>
                </div>
                <div class="mt-3">
                    <small class="text-muted">
                        Si el problema persiste, contacta al soporte técnico.
                    </small>
                </div>
            `;
            
            // Limpiar el contenedor primero
            calendarEl.innerHTML = '';
            calendarEl.appendChild(errorMessage);
        }
    }

    // --- CARGA DE DATOS POR SECCIÓN ---
    function loadSectionData(sectionName) {
        console.log(`Cargando sección: ${sectionName}`);
        switch(sectionName) {
            case 'inicio-prestador':
                loadPrestadorData();
                break;
            case 'inicio-cliente':
                loadClienteData();
                break;
            case 'agenda-prestador':
                console.log('Inicializando calendario para agenda...');
                inicializarCalendario();
                break;
            case 'publicar-oficio':
                // Inicializar formulario si es necesario
                break;
            case 'mis-publicaciones':
                loadMisPublicaciones();
                break;
            case 'solicitudes':
                loadSolicitudesPrestador();
                break;
            case 'buscar-servicios':
                // Aplicar búsqueda si hay filtros guardados
                const savedQuery = sessionStorage.getItem('busquedaQuery');
                const savedCategoria = sessionStorage.getItem('busquedaCategoria');
                const savedRangoPrecio = sessionStorage.getItem('busquedaRangoPrecio');

                if (savedQuery || savedCategoria || savedRangoPrecio) {
                    document.getElementById('busquedaPrincipal').value = savedQuery || '';
                    document.getElementById('filtroCategoria').value = savedCategoria || '';
                    document.getElementById('filtroPrecio').value = savedRangoPrecio ? savedRangoPrecio.split('-')[1] || '2000' : '2000';
                    document.getElementById('precioMaxLabel').textContent = `$${document.getElementById('filtroPrecio').value}`;
                    
                    // Limpiar el almacenamiento
                    sessionStorage.removeItem('busquedaQuery');
                    sessionStorage.removeItem('busquedaCategoria');
                    sessionStorage.removeItem('busquedaRangoPrecio');
                    
                    aplicarFiltrosBusqueda();
                }
                break;
            case 'categorias':
                loadCategorias();
                break;
            case 'mis-solicitudes-cliente':
                loadMisSolicitudesCliente();
                break;
        }
    }

    async function loadMisSolicitudesCliente() {
        try {
            const response = await fetch('/mis_solicitudes_cliente', {
                credentials: 'same-origin'
            });
            const result = await response.json();
            
            if (response.ok && result.success) {
                const solicitudes = result.solicitudes;
                const container = document.getElementById('mis-solicitudes-body');
                
                if (container) {
                    if (solicitudes.length === 0) {
                        container.innerHTML = `
                            <tr>
                                <td colspan="6" class="text-center">
                                    <i class="bi bi-inbox display-4 text-muted"></i>
                                    <p class="mt-2">No tienes solicitudes enviadas</p>
                                </td>
                            </tr>
                        `;
                    } else {
                        container.innerHTML = solicitudes.map(sol => `
                            <tr>
                                <td>${sol.titulo_publicacion}</td>
                                <td>${sol.prestador_nombre}</td>
                                <td>${sol.fecha_solicitud}</td>
                                <td>$${sol.precio || 'Consultar'}</td>
                                <td>
                                    <span class="badge ${sol.estado === 'pendiente' ? 'bg-warning' : sol.estado === 'aceptada' ? 'bg-success' : 'bg-danger'}">
                                        ${sol.estado}
                                    </span>
                                </td>
                                <td>
                                    <button class="btn btn-sm btn-outline-primary" onclick="verDetallesSolicitudCliente(${sol.id})">
                                        Ver detalles
                                    </button>
                                </td>
                            </tr>
                        `).join('');
                    }
                }
            } else {
                showCustomAlert(result.message || 'Error al cargar las solicitudes.');
            }
        } catch (error) {
            console.error('Error al cargar solicitudes del cliente:', error);
            showCustomAlert('Error de conexión al cargar las solicitudes.');
        }
    }

    function loadInitialData() {
        // Cargar datos iniciales según el tipo de usuario
        if (userType === 'prestador') {
            loadPrestadorData();
        } else {
            loadClienteData();
        }
    }

    // --- FUNCIONES GLOBALES PARA BOTONES ---
    window.togglePublicacion = async function(publicacionId, estadoActual) {
        try {
            const response = await fetch(`/toggle_publicacion/${publicacionId}`, {
                method: 'POST',
                credentials: 'same-origin'
            });
            const result = await response.json();
            
            if (response.ok && result.success) {
                showCustomAlert(result.message);
                // Recargar las publicaciones
                loadMisPublicaciones();
            } else {
                showCustomAlert(result.message || 'Error al cambiar el estado de la publicación.');
            }
        } catch (error) {
            console.error('Error al cambiar estado de publicación:', error);
            showCustomAlert('Error de conexión al cambiar el estado.');
        }
    };

    // --- FUNCIONES PARA ACEPTAR/RECHAZAR SOLICITUDES ---
    window.aceptarSolicitud = async function(solicitudId) {
        if (!confirm('¿Estás seguro de que deseas aceptar esta solicitud? El trabajo aparecerá en tu agenda.')) {
            return;
        }
        
        try {
            console.log(`Aceptando solicitud ${solicitudId}...`);
            const response = await fetch(`/actualizar_estado_solicitud/${solicitudId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'same-origin',
                body: JSON.stringify({ estado: 'aceptada' })
            });
            
            const result = await response.json();
            console.log('Respuesta de aceptación:', result);
            
            if (response.ok && result.success) {
                showCustomAlert(result.message);
                // Recargar las solicitudes
                loadSolicitudesPrestador();
                
                // Recargar el calendario si estamos en la sección de agenda
                if (document.getElementById('agenda-prestador-section') && 
                    !document.getElementById('agenda-prestador-section').classList.contains('d-none')) {
                    
                    console.log('Recargando calendario después de aceptar solicitud...');
                    (async () => {
                        const ok = await recargarCalendarioConRetry(6, 800);
                        if (!ok) {
                            showCustomAlert('La solicitud fue aceptada pero no se cargaron eventos en la agenda. Intenta recargar la página (F5).');
                        }
                    })();
                }
            } else {
                console.error('Error del servidor:', result.message);
                showCustomAlert(result.message || 'Error al aceptar la solicitud.');
            }
        } catch (error) {
            console.error('Error al aceptar solicitud:', error);
            showCustomAlert('Error de conexión al aceptar la solicitud: ' + error.message);
        }
    };

    window.rechazarSolicitud = async function(solicitudId) {
        if (!confirm('¿Estás seguro de que deseas rechazar esta solicitud?')) {
            return;
        }
        
        try {
            const response = await fetch(`/actualizar_estado_solicitud/${solicitudId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'same-origin',
                body: JSON.stringify({ estado: 'rechazada' })
            });
            
            const result = await response.json();
            
            if (response.ok && result.success) {
                showCustomAlert(result.message);
                // Recargar las solicitudes
                loadSolicitudesPrestador();
            } else {
                showCustomAlert(result.message || 'Error al rechazar la solicitud.');
            }
        } catch (error) {
            console.error('Error al rechazar solicitud:', error);
            showCustomAlert('Error de conexión al rechazar la solicitud.');
        }
    };

    // --- FUNCIONES PARA EDITAR PUBLICACIONES ---
    window.editarPublicacion = async function(publicacionId) {
        try {
            const response = await fetch(`/obtener_publicacion/${publicacionId}`, {
                credentials: 'same-origin'
            });
            const result = await response.json();
            
            if (response.ok && result.success) {
                const publicacion = result.publicacion;
                
                // Llenar el formulario de edición con los datos actuales
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
                
                // Mostrar el modal de edición
                const editarModal = new bootstrap.Modal(document.getElementById('editarPublicacionModal'));
                editarModal.show();
            } else {
                showCustomAlert(result.message || 'Error al cargar la publicación para editar.');
            }
        } catch (error) {
            console.error('Error al cargar publicación para editar:', error);
            showCustomAlert('Error de conexión al cargar la publicación.');
        }
    };

    // Función para guardar los cambios de la edición
    window.guardarEdicionPublicacion = async function() {
        const publicacionId = document.getElementById('editarPublicacionId').value;
        
        if (!publicacionId) {
            showCustomAlert('Error: No se encontró el ID de la publicación.');
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
                showCustomAlert(result.message);
                // Cerrar el modal
                const editarModal = bootstrap.Modal.getInstance(document.getElementById('editarPublicacionModal'));
                editarModal.hide();
                // Recargar las publicaciones
                loadMisPublicaciones();
            } else {
                showCustomAlert(result.message || 'Error al actualizar la publicación.');
            }
        } catch (error) {
            console.error('Error al actualizar publicación:', error);
            showCustomAlert('Error de conexión al actualizar la publicación.');
        }
    };

    window.verDetallesServicio = function(servicioId) {
        cargarDetallesServicio(servicioId);
    };

    window.filtrarPorCategoria = function(categoriaId) {
        showSection('buscar-servicios');
        // Aplicar el filtro por categoría
        document.getElementById('filtroCategoria').value = categoriaId;
        aplicarFiltrosBusqueda();
    };

    window.verDetallesSolicitud = function(solicitudId) {
        showCustomAlert(`Función de ver detalles de solicitud ${solicitudId} - Próximamente`);
    };

    window.verDetallesSolicitudCliente = function(solicitudId) {
        showCustomAlert(`Función de ver detalles de solicitud del cliente ${solicitudId} - Próximamente`);
    };

    // --- FUNCIÓN DE DIAGNÓSTICO ---
    window.diagnosticarAgenda = async function() {
        console.log('=== DIAGNÓSTICO DE AGENDA ===');
        
        try {
            // 1. Verificar datos de usuario
            console.log('Datos de usuario:', userData);
            console.log('Tipo de usuario:', userType);
            console.log('User ID:', userData.id || 'No disponible');
            
            // 2. Verificar solicitudes aceptadas
            const debugResponse = await fetch('/debug_solicitudes', {
                credentials: 'same-origin'
            });
            const debugData = await debugResponse.json();
            console.log('Datos de debug:', debugData);
            
            // 3. Verificar eventos del calendario
            const eventos = await cargarEventosAgenda();
            console.log('Eventos del calendario:', eventos);
            
            showCustomAlert('Diagnóstico completado. Revisa la consola (F12) para ver los detalles.');
            
            return {
                usuario: userData,
                debug: debugData,
                eventos: eventos
            };
        } catch (error) {
            console.error('Error en diagnóstico:', error);
            showCustomAlert('Error en diagnóstico: ' + error.message);
            return { error: error.message };
        }
    }

    // Ejecutar diagnóstico cuando se presiona Ctrl+Shift+D
    document.addEventListener('keydown', (event) => {
        if (event.ctrlKey && event.shiftKey && event.key === 'D') {
            event.preventDefault();
            diagnosticarAgenda();
        }
    });

    // Exponer función de diagnóstico globalmente
    window.diagnosticarAgenda = diagnosticarAgenda;

    // --- función para mostrar alertas personalizadas ---
    const customAlertOverlay = document.getElementById('customAlertOverlay');
    const customAlertMessage = document.getElementById('customAlertMessage');
    const customAlertCloseBtn = document.getElementById('customAlertClose');

    function showCustomAlert(message) {
        if (customAlertOverlay && customAlertMessage && customAlertCloseBtn) {
            customAlertMessage.textContent = message;
            customAlertOverlay.classList.add('show');
            document.body.classList.add('overlay-active');
        } else {
            alert(message);
        }
    }

    function hideCustomAlert() {
        if (customAlertOverlay) {
            customAlertOverlay.classList.remove('show');
            document.body.classList.remove('overlay-active');
        }
    }

    if (customAlertCloseBtn) {
        customAlertCloseBtn.addEventListener('click', hideCustomAlert);
    }

    if (customAlertOverlay) {
        customAlertOverlay.addEventListener('click', (event) => {
            if (event.target === customAlertOverlay) {
                hideCustomAlert();
            }
        });
    }

    // ajusta visibilidad del sidebar al cambiar tamaño de ventana
    window.addEventListener('resize', () => {
        if (window.innerWidth >= 992) {
            const activeSidebar = document.querySelector('.sidebar:not(.d-none)');
            if (activeSidebar) {
                activeSidebar.classList.remove('show');
            }
            body.classList.remove('sidebar-open');
        }
    });

    // Inicializar dashboard
    initializeDashboard();
});