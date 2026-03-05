/*********** lógica de la aplicación ***********/
document.addEventListener('DOMContentLoaded', function() {

    /*********** elementos del dom ***********/
    const loader = document.getElementById('loader');
    const registerForm = document.getElementById('registerForm');
    const candidateFields = document.getElementById('candidateFields');

    // campos comunes
    const emailInput = document.getElementById('emailInput');
    const passwordInput = document.getElementById('passwordInput');
    const confirmPasswordInput = document.getElementById('confirmPasswordInput');
    const termsCheck = document.getElementById('termsCheck');
    const userTypeSelect = document.getElementById('userType'); // NUEVO: campo de tipo de usuario

    const emailError = document.getElementById('emailError');
    const passwordError = document.getElementById('passwordError');
    const confirmPasswordError = document.getElementById('confirmPasswordError');
    const termsError = document.getElementById('termsError');
    const userTypeError = document.getElementById('userTypeError'); // NUEVO: error de tipo de usuario

    // elementos para mostrar/ocultar contraseña
    const togglePassword = document.getElementById('togglePassword');
    const toggleConfirmPassword = document.getElementById('toggleConfirmPassword');

    // campos específicos de candidato
    const firstNameInput = document.getElementById('firstNameInput');
    const lastNamePInput = document.getElementById('lastNamePInput');
    const lastNameMInput = document.getElementById('lastNameMInput');
    const candidatePhoneInput = document.getElementById('candidatePhoneInput');

    const firstNameError = document.getElementById('firstNameError');
    const lastNamePError = document.getElementById('lastNamePError');
    const lastNameMError = document.getElementById('lastNameMError');
    const candidatePhoneError = document.getElementById('candidatePhoneError');

    // elementos de la alerta personalizada
    const customAlert = document.getElementById('customAlert');
    const customAlertMessage = document.getElementById('customAlertMessage');
    const customAlertClose = document.getElementById('customAlertClose');

    /*********** lógica del loader ***********/
    // ocultar loader inicial
    window.addEventListener('load', () => {
        loader.style.opacity = '0';
        setTimeout(() => {
            loader.style.display = 'none';
        }, 500); // espera a que la transición termine
    });

    // mostrar loader con mensaje
    function showLoader(message) {
        loader.querySelector('p').textContent = message;
        loader.style.display = 'flex';
        loader.style.opacity = '1';
    }

    // ocultar loader
    function hideLoader() {
        loader.style.opacity = '0';
        setTimeout(() => {
            loader.style.display = 'none';
        }, 500);
    }

    /*********** funciones de utilidad para la alerta personalizada ***********/
    function showCustomAlert(message) {
        customAlertMessage.textContent = message;
        customAlert.classList.add('show');
    }

    function hideCustomAlert() {
        customAlert.classList.remove('show');
    }

    customAlertClose.addEventListener('click', hideCustomAlert);

    /*********** funciones de utilidad ***********/
    // función para mostrar/ocultar campos relevantes (simplificada, ahora solo muestra campos de candidato)
    function toggleFields() {
        candidateFields.style.display = 'block';
        // restablecer también los errores de los campos comunes
        hideError(emailError);
        hideError(passwordError);
        hideError(confirmPasswordError);
        hideError(termsError);
        hideError(userTypeError); // NUEVO: restablecer error de tipo de usuario
    }

    // función para restablecer el estado de validación de los campos dentro de un contenedor
    function resetValidation(container) {
        const inputs = container.querySelectorAll('input');
        inputs.forEach(input => {
            input.classList.remove('is-invalid');
            const errorElement = input.closest('.mb-3')?.querySelector('.error-message');
            if (errorElement) {
                errorElement.textContent = '';
                element.style.display = 'none';
            }
        });
    }

    // función para mostrar mensajes de error
    function showError(element, message) {
        element.textContent = message;
        element.style.display = 'block';
        // encontrar el input o input-group asociado y añadir la clase is-invalid
        const parentDiv = element.closest('.mb-3');
        if (parentDiv) {
            const input = parentDiv.querySelector('input');
            const inputGroup = parentDiv.querySelector('.input-group');
            const checkbox = parentDiv.querySelector('input[type="checkbox"]');
            const select = parentDiv.querySelector('select'); // NUEVO: manejar select

            if (inputGroup) {
                inputGroup.querySelector('input').classList.add('is-invalid');
            } else if (input) {
                input.classList.add('is-invalid');
            } else if (checkbox) {
                checkbox.classList.add('is-invalid');
            } else if (select) { // NUEVO: si es un select
                select.classList.add('is-invalid');
            }
        }
    }

    // función para ocultar mensajes de error
    function hideError(element) {
        element.textContent = '';
        element.style.display = 'none';
        // encontrar el input o input-group asociado y remover la clase is-invalid
        const parentDiv = element.closest('.mb-3');
        if (parentDiv) {
            const input = parentDiv.querySelector('input');
            const inputGroup = parentDiv.querySelector('.input-group');
            const checkbox = parentDiv.querySelector('input[type="checkbox"]');
            const select = parentDiv.querySelector('select'); // NUEVO: manejar select

            if (inputGroup) {
                inputGroup.querySelector('input').classList.remove('is-invalid');
            } else if (input) {
                input.classList.remove('is-invalid');
            } else if (checkbox) {
                checkbox.classList.remove('is-invalid');
            } else if (select) { // NUEVO: si es un select
                select.classList.remove('is-invalid');
            }
        }
    }

    // función auxiliar para validar el formato de correo electrónico (más estricta)
    function isValidEmail(email) {
        // regex para validar correos con dominio y extensión (ej. .com, .org, .mx)
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return emailRegex.test(email);
    }

    // función para capitalizar la primera letra de cada palabra
    function capitalizeFirstLetter(string) {
        if (!string) return '';
        // capitaliza la primera letra de cada palabra para nombres y apellidos
        return string.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
    }

    // función para validar campos de texto que solo deben contener letras, espacios y acentos
    function isValidPersonNameField(inputElement, errorElement, fieldName) {
        let value = inputElement.value.trim(); // asegurar que se trimmee el valor
        const lettersSpacesAccentsRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/; // permite letras, espacios y acentos

        if (value === '') {
            showError(errorElement, `${fieldName} es obligatorio.`);
            return false;
        } else if (!lettersSpacesAccentsRegex.test(value)) {
            showError(errorElement, `solo se permiten letras, espacios y acentos en ${fieldName.toLowerCase()}.`);
            return false;
        } else if (value.split(' ').filter(word => word !== '').length > 1 && (fieldName === 'apellido paterno' || fieldName === 'apellido materno')) {
            // Validar que no haya más de una palabra para apellidos
            showError(errorElement, `solo se permite un apellido en el campo de ${fieldName.toLowerCase()}.`);
            return false;
        } else {
            hideError(errorElement);
            return true;
        }
    }

    // función para validar campos de teléfono (solo dígitos)
    function isValidPhoneNumber(inputElement, errorElement, fieldName) {
        let value = inputElement.value;
        const digitsOnlyRegex = /^[0-9]+$/;
        if (value !== '' && !digitsOnlyRegex.test(value)) {
            showError(errorElement, `solo se permiten números en ${fieldName.toLowerCase()}.`);
            return false;
        } else {
            hideError(errorElement);
            return true;
        }
    }

    // función para validar la complejidad de la contraseña
    function isValidPassword(password) {
        const minLength = 8;
        const hasUpperCase = /[A-Z]/.test(password);
        const hasNumber = /[0-9]/.test(password); // al menos un número
        const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password); // caracteres especiales definidos

        if (password.length < minLength) {
            return 'la contraseña debe tener al menos 8 caracteres.';
        }
        if (!hasUpperCase) {
            return 'la contraseña debe contener al menos una letra mayúscula.';
        }
        if (!hasNumber) {
            return 'la contraseña debe contener al menos un número.';
        }
        if (!hasSpecialChar) {
            return 'la contraseña debe contener al menos un carácter especial (!@#$%^&*(),.?:{}|<>).';
        }
        return ''; // retorna vacío si es válida
    }

    // función para alternar la visibilidad de la contraseña
    function setupPasswordToggle(inputElement, toggleButton) {
        toggleButton.addEventListener('click', function() {
            const icon = this.querySelector('i');
            if (inputElement.type === 'password') {
                inputElement.type = 'text';
                icon.classList.remove('bi-eye-fill');
                icon.classList.add('bi-eye-slash-fill');
            } else {
                inputElement.type = 'password';
                icon.classList.remove('bi-eye-slash-fill');
                icon.classList.add('bi-eye-fill');
            }
        });
    }

    // NUEVA FUNCIÓN: validar tipo de usuario
    function validateUserType(selectElement, errorElement, fieldName) {
        const value = selectElement.value;
        if (value === '') {
            showError(errorElement, `${fieldName} es obligatorio.`);
            return false;
        } else {
            hideError(errorElement);
            return true;
        }
    }

    /*********** inicialización y eventos ***********/
    toggleFields(); // mostrar campos iniciales de candidato

    // configurar el toggle para las contraseñas
    setupPasswordToggle(passwordInput, togglePassword);
    setupPasswordToggle(confirmPasswordInput, toggleConfirmPassword);

    /*********** validación en tiempo real ***********/
    function addValidationOnBlurAndInput(inputElement, validationFunction, errorElement, fieldName) {
        inputElement.addEventListener('blur', () => {
            validationFunction(inputElement, errorElement, fieldName);
        });
        inputElement.addEventListener('input', () => {
            validationFunction(inputElement, errorElement, fieldName);
        });
    }

    // campos de candidato
    addValidationOnBlurAndInput(firstNameInput, isValidPersonNameField, firstNameError, 'nombre(s)');
    addValidationOnBlurAndInput(lastNamePInput, isValidPersonNameField, lastNamePError, 'apellido paterno');
    addValidationOnBlurAndInput(lastNameMInput, isValidPersonNameField, lastNameMError, 'apellido materno');
    addValidationOnBlurAndInput(candidatePhoneInput, isValidPhoneNumber, candidatePhoneError, 'número de teléfono');

    // NUEVO: validación en tiempo real para el tipo de usuario
    userTypeSelect.addEventListener('change', () => {
        validateUserType(userTypeSelect, userTypeError, 'tipo de cuenta');
    });

    // campos comunes
    emailInput.addEventListener('input', () => {
        if (emailInput.value === '') {
            hideError(emailError);
        } else if (!isValidEmail(emailInput.value)) {
            showError(emailError, 'Introduce un correo electrónico válido (ej. usuario@dominio.com).');
        } else {
            hideError(emailError);
        }
    });
    emailInput.addEventListener('blur', () => {
        if (emailInput.value === '') {
            showError(emailError, 'El correo electrónico es obligatorio.');
        } else if (!isValidEmail(emailInput.value)) {
            showError(emailError, 'Introduce un correo electrónico válido (ej. usuario@dominio.com).');
        } else {
            hideError(emailError);
        }
    });

    passwordInput.addEventListener('input', () => {
        const validationMessage = isValidPassword(passwordInput.value);
        if (validationMessage) {
            showError(passwordError, validationMessage);
        } else {
            hideError(passwordError);
        }
        if (confirmPasswordInput.value !== '') {
            if (confirmPasswordInput.value !== passwordInput.value) {
                showError(confirmPasswordError, 'Las contraseñas no coinciden.');
            } else {
                hideError(confirmPasswordError);
            }
        }
    });

    passwordInput.addEventListener('blur', () => {
        const validationMessage = isValidPassword(passwordInput.value);
        if (validationMessage) {
            showError(passwordError, validationMessage);
        } else {
            hideError(passwordError);
        }
    });

    confirmPasswordInput.addEventListener('input', () => {
        if (confirmPasswordInput.value === '') {
            hideError(confirmPasswordError);
        } else if (confirmPasswordInput.value !== passwordInput.value) {
            showError(confirmPasswordError, 'Las contraseñas no coinciden.');
        } else {
            hideError(confirmPasswordError);
        }
    });
    confirmPasswordInput.addEventListener('blur', () => {
        if (confirmPasswordInput.value === '') {
            showError(confirmPasswordError, 'Confirma tu contraseña.');
        } else if (confirmPasswordInput.value !== passwordInput.value) {
            showError(confirmPasswordError, 'Las contraseñas no coinciden.');
        } else {
            hideError(confirmPasswordError);
        }
    });

    termsCheck.addEventListener('change', () => {
        if (termsCheck.checked) hideError(termsError);
    });

    /*********** envío del formulario ***********/
    registerForm.addEventListener('submit', async function(event) {
        event.preventDefault();

        // limpiar errores previos
        document.querySelectorAll('.error-message').forEach(el => hideError(el));
        document.querySelectorAll('.form-control, .form-check-input, .form-select').forEach(el => el.classList.remove('is-invalid'));

        let isValid = true;

        // recopilar y limpiar datos
        const formData = new FormData(registerForm);
        const data = {};
        formData.forEach((value, key) => {
            // limpiar espacios de todos los campos de texto
            if (typeof value === 'string') {
                data[key] = value.trim();
            } else {
                data[key] = value;
            }
        });
        
        // asegurar que el tipo de usuario esté presente
        data['userType'] = userTypeSelect.value; // NUEVO: agregar el tipo de usuario

        // aplicar capitalización a nombres/apellidos después del trim
        data['firstName'] = capitalizeFirstLetter(data['firstName']);
        data['lastNameP'] = capitalizeFirstLetter(data['lastNameP']);
        data['lastNameM'] = capitalizeFirstLetter(data['lastNameM']);
        
        // re-validar todos los campos antes de enviar (para mostrar errores si los hay)
        // se usa una variable temporal para no detener la validación completa
        let currentFormIsValid = true;

        if (data['email'] === '') {
            showError(emailError, 'el correo electrónico es obligatorio.');
            currentFormIsValid = false;
        } else if (!isValidEmail(data['email'])) {
            showError(emailError, 'introduce un correo electrónico válido (ej. usuario@dominio.com).');
            currentFormIsValid = false;
        }

        const passwordValidationResult = isValidPassword(data['password']);
        if (passwordValidationResult) {
            showError(passwordError, passwordValidationResult);
            currentFormIsValid = false;
        }

        if (data['confirmPassword'] === '') {
            showError(confirmPasswordError, 'confirma tu contraseña.');
            currentFormIsValid = false;
        } else if (data['confirmPassword'] !== data['password']) {
            showError(confirmPasswordError, 'las contraseñas no coinciden.');
            currentFormIsValid = false;
        }

        if (!termsCheck.checked) {
            showError(termsError, 'debes aceptar los términos y condiciones.');
            currentFormIsValid = false;
        }

        // NUEVO: validar tipo de usuario
        if (!validateUserType(userTypeSelect, userTypeError, 'tipo de cuenta')) currentFormIsValid = false;

        // validación de campos de candidato
        if (!isValidPersonNameField(firstNameInput, firstNameError, 'nombre(s)')) currentFormIsValid = false;
        if (!isValidPersonNameField(lastNamePInput, lastNamePError, 'apellido paterno')) currentFormIsValid = false;
        if (!isValidPersonNameField(lastNameMInput, lastNameMError, 'apellido materno')) currentFormIsValid = false;
        if (data['candidatePhone'] !== '' && !isValidPhoneNumber(candidatePhoneInput, candidatePhoneError, 'número de teléfono')) currentFormIsValid = false;
        
        isValid = currentFormIsValid; // Actualizar isValid con el resultado de la validación completa

        if (!isValid) {
            showCustomAlert('por favor, corrige los errores en el formulario antes de continuar.');
            return; // detener el envío si hay errores de validación del cliente
        }

        // si todos los campos son válidos, enviar al servidor
        showLoader('registrando...'); // mostrar loader antes de enviar la petición

        try {
            const response = await fetch('/registrar_usuario_web', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (response.ok) {
                showCustomAlert('¡registro exitoso! ahora puedes iniciar sesión.');
                // esperar un momento para que el usuario vea el mensaje antes de redirigir
                setTimeout(() => {
                    window.location.href = 'login.html'; // redirigir a la página de login
                }, 1500); // 1.5 segundos
            } else {
                hideLoader(); // ocultar loader si hay errores del servidor
                // mostrar errores del servidor
                if (result.errors) {
                    for (const field in result.errors) {
                        const errorElement = document.getElementById(`${field}Error`);
                        if (errorElement) {
                            showError(errorElement, result.errors[field]);
                        }
                    }
                    showCustomAlert('por favor, corrige los errores indicados.');
                } else if (result.message) {
                    showCustomAlert(`error: ${result.message}`);
                } else {
                    showCustomAlert('ocurrió un error desconocido durante el registro.');
                }
            }
        } catch (error) {
            hideLoader(); // ocultar loader en caso de error de conexión
            console.error('error al enviar el formulario:', error);
            showCustomAlert('error de conexión. por favor, inténtalo de nuevo más tarde.');
        }
    });
});