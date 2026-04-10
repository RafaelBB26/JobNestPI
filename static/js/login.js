document.addEventListener('DOMContentLoaded', function() {
    // referencias a elementos del dom
    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('emailInput');
    const passwordInput = document.getElementById('passwordInput');
    const emailError = document.getElementById('emailError');
    const passwordError = document.getElementById('passwordError');
    const loaderOverlay = document.getElementById('loaderOverlay');
    const pageLoaderOverlay = document.getElementById('pageLoaderOverlay');

    // elementos de la alerta personalizada
    const customAlert = document.getElementById('customAlert');
    const customAlertMessage = document.getElementById('customAlertMessage');
    const customAlertClose = document.getElementById('customAlertClose');

    // ocultar el loader de carga de página una vez que el dom está completamente cargado
    pageLoaderOverlay.classList.add('hidden');

    /*********** funciones para la alerta personalizada ***********/
    function showCustomAlert(message) {
        customAlertMessage.textContent = message;
        customAlert.classList.add('show');
    }

    function hideCustomAlert() {
        customAlert.classList.remove('show');
    }

    customAlertClose.addEventListener('click', hideCustomAlert);

    // función para mostrar mensajes de error
    function showError(element, message) {
        element.textContent = message;
        element.style.display = 'block';
        element.previousElementSibling.classList.add('is-invalid');
    }

    // función para ocultar mensajes de error
    function hideError(element) {
        element.textContent = '';
        element.style.display = 'none';
        element.previousElementSibling.classList.remove('is-invalid');
    }

    // funciones para mostrar y ocultar el loader de inicio de sesión
    function showLoader() {
        loaderOverlay.style.display = 'flex';
    }

    function hideLoader() {
        loaderOverlay.style.display = 'none';
    }

    // función para validar formato de correo electrónico
    function isValidEmail(email) {
        // regex para validar correos con dominio y extensión (ej. .com, .org, .mx)
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return emailRegex.test(email);
    }

    // event listener para la validación en tiempo real (al escribir o cambiar el foco)
    emailInput.addEventListener('input', () => {
        if (emailInput.value.trim() === '') {
            hideError(emailError);
        } else if (!isValidEmail(emailInput.value.trim())) {
            showError(emailError, 'Introduce un correo electrónico válido (ej. usuario@dominio.com).');
        } else {
            hideError(emailError);
        }
    });

    emailInput.addEventListener('blur', () => {
        if (emailInput.value.trim() === '') {
            showError(emailError, 'El correo electrónico es obligatorio.');
        } else if (!isValidEmail(emailInput.value.trim())) {
            showError(emailError, 'Introduce un correo electrónico válido (ej. usuario@dominio.com).');
        } else {
            hideError(emailError);
        }
    });

    passwordInput.addEventListener('input', () => {
        if (passwordInput.value.trim() !== '') {
            hideError(passwordError);
        }
    });

    passwordInput.addEventListener('blur', () => {
        if (passwordInput.value.trim() === '') {
            showError(passwordError, 'La contraseña es obligatoria.');
        } else {
            hideError(passwordError);
        }
    });

    // event listener para la validación al intentar enviar el formulario
    loginForm.addEventListener('submit', async function(event) {
        // previene el envío por defecto del formulario
        event.preventDefault();

        // limpiar errores previos
        hideError(emailError);
        hideError(passwordError);

        let isValid = true;

        // validar campo de correo
        if (emailInput.value.trim() === '') {
            showError(emailError, 'El correo electrónico es obligatorio.');
            isValid = false;
        } else if (!isValidEmail(emailInput.value.trim())) {
            showError(emailError, 'Introduce un correo electrónico válido (ej. usuario@dominio.com).');
            isValid = false;
        }

        // validar campo de contraseña
        if (passwordInput.value.trim() === '') {
            showError(passwordError, 'La contraseña es obligatoria.');
            isValid = false;
        }

        // si hay errores de validación del cliente, mostrar alerta y detener
        if (!isValid) {
            showCustomAlert('Por favor, ingresa credenciales válidas para iniciar sesión.');
            return;
        }

        // si todos los campos son válidos, muestra el loader y envía los datos al servidor
        showLoader();

        try {
            const formData = new FormData();
            formData.append('email', emailInput.value.trim());
            formData.append('password', passwordInput.value.trim());

            const response = await fetch('/login', {
                method: 'POST',
                body: formData // enviar como form-data para que flask.request.form lo reciba
            });

            const result = await response.json(); // asumiendo que el servidor responde con json

            if (response.ok) {
                // si el inicio de sesión es exitoso
                showCustomAlert('¡Inicio de sesión exitoso! bienvenido a Tu bolsa de trabajo.');
                setTimeout(() => {
                    window.location.href = 'dashboard.html'; // redirige al usuario al dashboard
                }, 1500); // espera 1.5 segundos para que el usuario vea la alerta
            } else {
                // si hay un error en el inicio de sesión
                hideLoader();
                if (result.message) {
                    showCustomAlert(result.message);
                } else {
                    showCustomAlert('Credenciales incorrectas. por favor, inténtalo de nuevo.');
                }
            }
        } catch (error) {
            hideLoader();
            console.error('error al enviar el formulario de login:', error);
            showCustomAlert('Error de conexión. por favor, inténtalo de nuevo más tarde.');
        }
    });
});