import os
from flask import Flask, render_template, request, redirect, url_for, flash, session, jsonify, send_from_directory
import pyodbc
from werkzeug.security import generate_password_hash, check_password_hash
from email_validator import validate_email, EmailNotValidError
from datetime import datetime, timedelta
import re # para expresiones regulares

# configuración de la aplicación flask
app = Flask(__name__,
            template_folder=os.path.abspath('.'), # busca html en la raíz del proyecto
            static_folder=os.path.abspath('.'))   # busca css/js/multimedia en la raíz del proyecto

app.secret_key = 'albertolunarufino'

# configuración de la conexión a la base de datos
DB_CONFIG = {
    'driver': '{ODBC Driver 18 for SQL Server}', 
    'server': '127.0.0.1,1433',   # MUY IMPORTANTE
    'database': 'JobNest',
    'user': 'SA',
    'password': 'E322158b@',
    'encrypt': 'yes',
    'trust_server_certificate': 'yes',
    'timeout': '30'
}


def get_db_connection():
    """Función para establecer la conexión a la base de datos."""
    try:
        cnxn = pyodbc.connect(
            f"DRIVER={DB_CONFIG['driver']};"
            f"SERVER={DB_CONFIG['server']};"
            f"DATABASE={DB_CONFIG['database']};"
            f"UID={DB_CONFIG['user']};"
            f"PWD={DB_CONFIG['password']};"
            f"Encrypt={DB_CONFIG['encrypt']};"
            f"TrustServerCertificate={DB_CONFIG['trust_server_certificate']};"
            f"Connection Timeout={DB_CONFIG['timeout']};"
        )
        print("✅ Conexión a la base de datos establecida con éxito.")
        return cnxn
    except pyodbc.Error as ex:
        sqlstate = ex.args[0]
        print(f"❌ Error al conectar a la base de datos (sqlstate: {sqlstate}): {ex}")
        raise

# carpeta para subir imágenes de perfil (si es necesario en el futuro)
UPLOAD_FOLDER = 'multimedia'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# crear la carpeta de uploads si no existe
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

# funciones de validación (para el lado del servidor)
def is_valid_email(email):
    """Valida el formato de correo electrónico con dominio y extensión."""
    try:
        # check_deliverability=false para no intentar contactar al servidor de correo
        validate_email(email, check_deliverability=False) 
        # expresión regular adicional para una validación más estricta del dominio y la extensión
        email_regex = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")
        return bool(email_regex.match(email))
    except EmailNotValidError:
        return False

def is_valid_password(password):
    """Valida la complejidad de la contraseña."""
    min_length = 8;
    has_upper_case = any(c.isupper() for c in password);
    has_number = any(c.isdigit() for c in password);
    has_special_char = any(c in "!@#$%^&*(),.?\":{}|<>" for c in password);

    if len(password) < min_length:
        return 'La contraseña debe tener al menos 8 caracteres.';
    if not has_upper_case:
        return 'La contraseña debe contener al menos una letra mayúscula.';
    if not has_number:
        return 'La contraseña debe contener al menos un número.';
    if not has_special_char:
        return 'La contraseña debe contener al menos un carácter especial (!@#$%^&*(),.?:{}|<>).';
    return ''; # vacío si es válida

def is_valid_person_name_field(name, is_apellido=False):
    """Valida que un nombre/apellido contenga solo letras, espacios y acentos, y un solo apellido si aplica."""
    letters_spaces_accents_regex = re.compile(r"^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$")
    if not bool(letters_spaces_accents_regex.match(name)):
        return False
    if is_apellido and len(name.split()) > 1:
        return False # si es un apellido y tiene más de una palabra
    return True

def is_valid_phone_number(phone):
    """Valida que un número de teléfono contenga solo dígitos y tenga entre 10 y 20 dígitos."""
    return re.fullmatch(r"^\d{10,20}$", phone)

# SOLUCIÓN: Cambiar la ruta principal para que renderice directamente el index.html
@app.route('/')
def index():
    return render_template('index.html')

# ruta para mostrar el formulario de registro
@app.route('/registro')
def mostrar_formulario_registro():
    return render_template('registro.html')

# ruta para registrar un nuevo usuario (desde el frontend con fetch)
@app.route('/registrar_usuario_web', methods=['POST'])
def registrar_usuario_web():
    if request.method == 'POST':
        data = request.get_json() # obtener los datos json enviados desde js
        errors = {}

        # limpiar y obtener campos comunes
        email = data.get('email', '').strip()
        password = data.get('password', '').strip()
        confirm_password = data.get('confirmPassword', '').strip()
        user_type = data.get('userType', '').strip()  # NUEVO: obtener el tipo de usuario
        # los checkboxes envían 'on' si están marcados
        terms_checked = data.get('termsCheck') == 'on' 

        # validación de campos comunes
        if not email:
            errors['email'] = 'El correo electrónico es obligatorio.'
        elif not is_valid_email(email):
            errors['email'] = 'Introduce un correo electrónico válido (ej. usuario@dominio.com).'

        password_validation_result = is_valid_password(password)
        if password_validation_result:
            errors['password'] = password_validation_result
        
        if not confirm_password:
            errors['confirmPassword'] = 'Confirma tu contraseña.'
        elif password != confirm_password:
            errors['confirmPassword'] = 'Las contraseñas no coinciden.'

        if not terms_checked:
            errors['termsCheck'] = 'Debes aceptar los términos y condiciones.'

        # NUEVO: validar tipo de usuario
        if not user_type:
            errors['userType'] = 'Selecciona un tipo de cuenta.'
        elif user_type not in ['prestador', 'cliente']:
            errors['userType'] = 'Tipo de cuenta no válido.'

        conn = None
        try:
            conn = get_db_connection()
            cursor = conn.cursor()

            # verificar si el correo ya existe
            cursor.execute("SELECT id FROM Usuarios WHERE Email = ?", (email,))
            if cursor.fetchone():
                errors['email'] = 'Este correo electrónico ya está registrado.'

            # validación de campos específicos
            first_name = data.get('firstName', '').strip()
            last_name_p = data.get('lastNameP', '').strip()
            last_name_m = data.get('lastNameM', '').strip()
            candidate_phone = data.get('candidatePhone', '').strip()

            # capitalizar nombres y apellidos después del strip
            first_name = ' '.join(word.capitalize() for word in first_name.split())
            last_name_p = ' '.join(word.capitalize() for word in last_name_p.split())
            last_name_m = ' '.join(word.capitalize() for word in last_name_m.split())

            if not first_name:
                errors['firstName'] = 'El nombre es obligatorio.'
            elif not is_valid_person_name_field(first_name):
                errors['firstName'] = 'Solo se permiten letras, espacios y acentos en el nombre.'
            
            if not last_name_p:
                errors['lastNameP'] = 'El apellido paterno es obligatorio.'
            elif not is_valid_person_name_field(last_name_p, is_apellido=True): # Validar un solo apellido
                errors['lastNameP'] = 'Solo se permite un apellido en el campo de apellido paterno.'
            
            if not last_name_m:
                errors['lastNameM'] = 'El apellido materno es obligatorio.'
            elif not is_valid_person_name_field(last_name_m, is_apellido=True): # Validar un solo apellido
                errors['lastNameM'] = 'Solo se permite un apellido en el campo de apellido materno.'
            
            if candidate_phone and not is_valid_phone_number(candidate_phone):
                errors['candidatePhone'] = 'El número de teléfono debe contener entre 10 y 20 dígitos numéricos.'

            if errors:
                return jsonify({'success': False, 'errors': errors, 'message': 'Errores de validación.'}), 400

            # MODIFICACIÓN: Usar transacción para atomicidad
            conn.autocommit = False  # Desactivar autocommit para controlar manualmente la transacción
            
            try:
                # hashear la contraseña
                hashed_password = generate_password_hash(password)

                # insertar en la tabla Usuarios
                sql_query_usuario = "INSERT INTO Usuarios (Email, PasswordHash, Activo, CreadoEn, UltimoLogin) VALUES (?, ?, ?, ?, ?)"
                current_time = datetime.now()
                cursor.execute(sql_query_usuario, (email, hashed_password, 1, current_time, current_time))

                # obtener el id del usuario recién insertado
                cursor.execute("SELECT id FROM Usuarios WHERE Email = ?", (email,))
                user_id = cursor.fetchone()[0]

                # insertar en la tabla Personas
                sql_query_persona = "INSERT INTO Personas (UsuarioId, Nombre, ApellidoP, ApellidoM, Telefono) VALUES (?, ?, ?, ?, ?)"
                cursor.execute(sql_query_persona, (user_id, first_name, last_name_p, last_name_m, candidate_phone if candidate_phone else None))
                
                # NUEVO: Si es prestador, insertar en la tabla Prestadores
                if user_type == 'prestador':
                    sql_query_prestador = "INSERT INTO Prestadores (UsuarioId, Verificado, RatingPromedio, TotalResenas) VALUES (?, ?, ?, ?)"
                    cursor.execute(sql_query_prestador, (user_id, 0, 0.0, 0))  # 0 para no verificado, rating 0, 0 reseñas
                
                # Confirmar la transacción si todo salió bien
                conn.commit()
                print("Datos insertados y commit realizado con éxito.")
                return jsonify({'success': True, 'message': '¡Registro exitoso!'}), 200

            except Exception as inner_ex:
                # Revertir la transacción en caso de error
                conn.rollback()
                raise inner_ex

        except pyodbc.Error as ex:
            sqlstate = ex.args[0]
            print(f"Error de base de datos en registro (sqlstate: {sqlstate}): {ex}")
            if sqlstate == '23000': # error de clave duplicada
                return jsonify({'success': False, 'message': 'El correo electrónico ya está registrado. por favor, utiliza otro.', 'errors': {'email': 'Este correo electrónico ya está registrado.'}}), 409
            else:
                return jsonify({'success': False, 'message': f"Ocurrió un error en la base de datos: {ex}"}), 500
        except Exception as e:
            print(f"Error inesperado en el servidor durante el registro: {e}")
            return jsonify({'success': False, 'message': f"Ocurrió un error inesperado en el servidor: {e}"}), 500
        finally:
            if conn:
                # Restaurar autocommit a True
                conn.autocommit = True
                conn.close()

# rutas de login
@app.route('/iniciar_sesion')
def mostrar_formulario_inicio_sesion():
    return render_template('login.html')

@app.route('/login', methods=['POST'])
def login_usuario():
    if request.method == 'POST':
        # imprimir datos recibidos del formulario para depuración
        print("\n--- Datos recibidos del formulario de login ---")
        for key, value in request.form.items():
            print(f"{key}: {value}")
        print("----------------------------------------------\n")

        correo = request.form.get('email', '').strip() # limpiar espacios
        contrasena_ingresada = request.form.get('password', '').strip() # limpiar espacios

        if not correo or not contrasena_ingresada:
            print("Error: correo o contraseña vacíos en login.")
            # Cambiado para devolver JSON en lugar de redireccionar
            return jsonify({'success': False, 'message': 'Por favor, ingresa tu correo y contraseña.'}), 400

        conn = None
        try:
            conn = get_db_connection()
            cursor = conn.cursor()

            # buscar el usuario y sus datos de perfil
            cursor.execute("""
                SELECT u.id, u.PasswordHash, u.Activo, u.Email,
                       u.CreadoEn, u.UltimoLogin
                FROM Usuarios u
                WHERE u.Email = ?
            """, (correo,))
            resultado = cursor.fetchone()
            
            if resultado:
                user_id = resultado[0]
                contrasena_hasheada_db = resultado[1]
                activo = resultado[2]
                correo_usuario = resultado[3]
                fecha_registro = resultado[4]
                ultima_sesion = resultado[5]

                print(f"Hash de db: {contrasena_hasheada_db}")

                if not activo:
                    return jsonify({'success': False, 'message': 'Tu cuenta está desactivada. Contacta al administrador.'}), 401

                if check_password_hash(contrasena_hasheada_db, contrasena_ingresada):
                    print("Inicio de sesión exitoso.")
                    
                    # actualizar la última sesión
                    cursor.execute("UPDATE Usuarios SET UltimoLogin = ? WHERE id = ?", (datetime.now(), user_id))
                    conn.commit()

                    # obtener datos de la persona
                    cursor.execute("SELECT Nombre, ApellidoP, ApellidoM, Telefono FROM Personas WHERE UsuarioId = ?", (user_id,))
                    persona_data = cursor.fetchone()
                    
                    # NUEVO: Determinar el tipo de usuario verificando si existe en Prestadores
                    cursor.execute("SELECT id FROM Prestadores WHERE UsuarioId = ?", (user_id,))
                    es_prestador = cursor.fetchone() is not None
                    tipo_usuario = 'prestador' if es_prestador else 'cliente'
                    
                    # almacenar información completa del usuario en la sesión
                    session['usuario_autenticado'] = True
                    session['user_id'] = user_id
                    session['correo'] = correo_usuario
                    session['tipo_usuario'] = tipo_usuario  # NUEVO: guardar el tipo de usuario en la sesión
                    session['fecha_registro'] = fecha_registro.strftime('%d de %B de %Y') if fecha_registro else 'n/a'
                    session['ultima_sesion'] = datetime.now().strftime('%d de %B de %Y, %I:%M %p')

                    if persona_data:
                        session['nombres'] = persona_data[0]
                        session['apellido_paterno'] = persona_data[1]
                        session['apellido_materno'] = persona_data[2]
                        session['telefono'] = persona_data[3]
                    else:
                        session['nombres'] = 'Usuario'
                        session['apellido_paterno'] = ''
                        session['apellido_materno'] = ''
                        session['telefono'] = ''
                    
                    # Devolver JSON para éxito
                    return jsonify({'success': True, 'message': '¡Bienvenido! has iniciado sesión exitosamente.'}), 200
                else:
                    print("Contraseña incorrecta.")
                    # Devolver JSON para contraseña incorrecta
                    return jsonify({'success': False, 'message': 'Contraseña incorrecta. por favor, inténtalo de nuevo.'}), 401
            else:
                print("Correo electrónico no encontrado.")
                # Devolver JSON para correo no registrado
                return jsonify({'success': False, 'message': 'Correo electrónico no registrado.'}), 404
            
        except pyodbc.Error as ex:
            sqlstate = ex.args[0]
            print(f"Error de base de datos en login (sqlstate: {sqlstate}): {ex}")
            return jsonify({'success': False, 'message': f"Ocurrió un error en la base de datos: {ex}"}), 500
        except Exception as e:
            print(f"Error inesperado en el servidor durante el login: {e}")
            return jsonify({'success': False, 'message': f"Ocurrió un error inesperado en el servidor: {e}"}), 500
        finally:
            if conn:
                conn.close()

# ruta del dashboard
@app.route('/dashboard')
def dashboard():
    # verificar si el usuario está autenticado, si no, redirigir al login
    if 'usuario_autenticado' not in session or not session['usuario_autenticado']:
        flash('Por favor, inicia sesión para acceder al dashboard.', 'info')
        return redirect(url_for('mostrar_formulario_inicio_sesion'))
    
    # los datos del usuario se obtendrán vía fetch en el frontend
    return render_template('dashboard.html')

# nueva ruta para obtener los datos del usuario (para el frontend)
@app.route('/get_user_data', methods=['GET'])
def get_user_data():
    if 'usuario_autenticado' not in session or not session['usuario_autenticado']:
        return jsonify({'message': 'No autenticado'}), 401

    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'message': 'Id de usuario no encontrado en la sesión'}), 400

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # obtener datos de la persona
        cursor.execute("""
            SELECT u.Email, p.Nombre, p.ApellidoP, p.ApellidoM, p.Telefono
            FROM Usuarios u
            JOIN Personas p ON u.id = p.UsuarioId
            WHERE u.id = ?
        """, (user_id,))
        user_data = cursor.fetchone()

        if not user_data:
            return jsonify({'message': 'Datos de usuario no encontrados'}), 404

        response_data = {
            'correo': user_data[0],
            'nombres': user_data[1],
            'apellido_paterno': user_data[2],
            'apellido_materno': user_data[3],
            'telefono': user_data[4],
            'tipo_usuario': session.get('tipo_usuario', 'cliente')  # Incluir tipo de usuario en la respuesta
        }
        return jsonify(response_data), 200

    except pyodbc.Error as ex:
        sqlstate = ex.args[0]
        print(f"Error de base de datos al obtener datos de usuario (sqlstate: {sqlstate}): {ex}")
        return jsonify({'message': f"Error de base de datos: {ex}"}), 500
    except Exception as e:
        print(f"Error inesperado al obtener datos de usuario: {e}")
        return jsonify({'message': f"Error inesperado: {e}"}), 500
    finally:
        if conn:
            conn.close()

# ruta para actualizar el perfil del usuario
@app.route('/actualizar_perfil', methods=['POST'])
def actualizar_perfil():
    if 'usuario_autenticado' not in session or not session['usuario_autenticado']:
        return jsonify({'success': False, 'message': 'Por favor, inicia sesión para actualizar tu perfil.'}), 401

    user_id = session.get('user_id')

    if not user_id:
        return jsonify({'success': False, 'message': 'Error: no se pudo encontrar el id de usuario en la sesión.'}), 400

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        nombres = request.form.get('nombres', '').strip()
        apellido_paterno = request.form.get('apellido_paterno', '').strip()
        apellido_materno = request.form.get('apellido_materno', '').strip()
        telefono = request.form.get('telefono', '').strip()

        # limpieza y capitalización
        if nombres: nombres = ' '.join(word.capitalize() for word in nombres.split())
        if apellido_paterno: apellido_paterno = ' '.join(word.capitalize() for word in apellido_paterno.split())
        if apellido_materno: apellido_materno = ' '.join(word.capitalize() for word in apellido_materno.split())

        # validación adicional para nombres/apellidos
        if not nombres:
            return jsonify({'success': False, 'message': 'El nombre es obligatorio.'}), 400
        if not is_valid_person_name_field(nombres):
            return jsonify({'success': False, 'message': 'El nombre solo debe contener letras, espacios y acentos.'}), 400
        
        if not apellido_paterno:
            return jsonify({'success': False, 'message': 'El apellido paterno es obligatorio.'}), 400
        if not is_valid_person_name_field(apellido_paterno, is_apellido=True):
            return jsonify({'success': False, 'message': 'El apellido paterno solo debe contener una palabra, letras, espacios y acentos.'}), 400
        
        if not apellido_materno:
            return jsonify({'success': False, 'message': 'El apellido materno es obligatorio.'}), 400
        if not is_valid_person_name_field(apellido_materno, is_apellido=True):
            return jsonify({'success': False, 'message': 'El apellido materno solo debe contener una palabra, letras, espacios y acentos.'}), 400
        
        if telefono and not is_valid_phone_number(telefono):
            return jsonify({'success': False, 'message': 'El número de teléfono debe contener entre 10 y 20 dígitos numéricos.'}), 400

        sql_update_persona = """
            UPDATE Personas 
            SET Nombre = ?, ApellidoP = ?, ApellidoM = ?, Telefono = ? 
            WHERE UsuarioId = ?
        """
        cursor.execute(sql_update_persona, (nombres, apellido_paterno, apellido_materno, telefono if telefono else None, user_id))
        
        # actualizar la sesión con los nuevos datos
        session['nombres'] = nombres
        session['apellido_paterno'] = apellido_paterno
        session['apellido_materno'] = apellido_materno
        session['telefono'] = telefono
        
        conn.commit()
        return jsonify({'success': True, 'message': 'Tu perfil ha sido actualizado exitosamente.'}), 200

    except pyodbc.Error as ex:
        sqlstate = ex.args[0]
        print(f"Error de base de datos al actualizar perfil (sqlstate: {sqlstate}): {ex}")
        return jsonify({'success': False, 'message': f"Ocurrió un error en la base de datos al actualizar tu perfil: {ex}"}), 500
    except Exception as e:
        print(f"Error inesperado al actualizar perfil: {e}")
        return jsonify({'success': False, 'message': f"Ocurrió un error inesperado al actualizar tu perfil: {e}"}), 500
    finally:
        if conn:
            conn.close()

# ruta para cambiar la contraseña
@app.route('/cambiar_contrasena', methods=['POST'])
def cambiar_contrasena():
    if 'usuario_autenticado' not in session or not session['usuario_autenticado']:
        return jsonify({'success': False, 'message': 'Por favor, inicia sesión para cambiar tu contraseña.'}), 401

    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'success': False, 'message': 'Error: no se pudo encontrar el id de usuario en la sesión.'}), 400

    contrasena_actual = request.form.get('contrasena_actual', '').strip()
    nueva_contrasena = request.form.get('nueva_contrasena', '').strip()
    confirmar_nueva_contrasena = request.form.get('confirmar_nueva_contrasena', '').strip()

    if not contrasena_actual:
        return jsonify({'success': False, 'message': 'La contraseña actual es obligatoria.'}), 400
    if not nueva_contrasena:
        return jsonify({'success': False, 'message': 'La nueva contraseña es obligatoria.'}), 400
    if not confirmar_nueva_contrasena:
        return jsonify({'success': False, 'message': 'Confirma tu nueva contraseña.'}), 400

    if nueva_contrasena != confirmar_nueva_contrasena:
        return jsonify({'success': False, 'message': 'Las contraseñas no coinciden.'}), 400
    
    password_validation_result = is_valid_password(nueva_contrasena)
    if password_validation_result:
        return jsonify({'success': False, 'message': password_validation_result}), 400

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # obtener la contraseña hasheada actual del usuario
        cursor.execute("SELECT PasswordHash FROM Usuarios WHERE id = ?", (user_id,))
        resultado = cursor.fetchone()

        if resultado and check_password_hash(resultado[0], contrasena_actual):
            # hashear la nueva contraseña
            nueva_contrasena_hasheada = generate_password_hash(nueva_contrasena)
            sql_update_contrasena = "UPDATE Usuarios SET PasswordHash = ? WHERE id = ?"
            cursor.execute(sql_update_contrasena, (nueva_contrasena_hasheada, user_id))
            conn.commit()
            return jsonify({'success': True, 'message': 'Tu contraseña ha sido cambiada exitosamente.'}), 200
        else:
            return jsonify({'success': False, 'message': 'La contraseña actual es incorrecta.'}), 401
        
    except pyodbc.Error as ex:
        sqlstate = ex.args[0]
        print(f"Error de base de datos al cambiar contraseña (sqlstate: {sqlstate}): {ex}")
        return jsonify({'success': False, 'message': f"Ocurrió un error en la base de datos: {ex}"}), 500
    except Exception as e:
        print(f"Error inesperado al cambiar contraseña: {e}")
        return jsonify({'success': False, 'message': f"Ocurrió un error inesperado al cambiar tu contraseña: {e}"}), 500
    finally:
        if conn:
            conn.close()

# ==================== RUTAS PARA PUBLICACIONES ====================

# Ruta para crear una nueva publicación de oficio
@app.route('/crear_publicacion', methods=['POST'])
def crear_publicacion():
    if 'usuario_autenticado' not in session or not session['usuario_autenticado']:
        return jsonify({'success': False, 'message': 'Por favor, inicia sesión para crear una publicación.'}), 401

    user_id = session.get('user_id')
    tipo_usuario = session.get('tipo_usuario')

    # Verificar que el usuario es un prestador
    if tipo_usuario != 'prestador':
        return jsonify({'success': False, 'message': 'Solo los prestadores pueden crear publicaciones.'}), 403

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Obtener datos del formulario
        titulo = request.form.get('titulo', '').strip()
        descripcion = request.form.get('descripcion', '').strip()
        categoria = request.form.get('categoria', '').strip()
        precio = request.form.get('salario', '').strip()
        ubicacion = request.form.get('ubicacion', '').strip()
        experiencia = request.form.get('experiencia', '').strip()
        habilidades = request.form.get('habilidades', '').strip()
        disponibilidad = request.form.get('disponibilidad', '').strip()
        tipo_precio = request.form.get('tipo_precio', 'hora')
        incluye_materiales = request.form.get('incluye_materiales') == 'on'

        # Validaciones básicas
        if not titulo:
            return jsonify({'success': False, 'message': 'El título es obligatorio.'}), 400
        if not descripcion:
            return jsonify({'success': False, 'message': 'La descripción es obligatoria.'}), 400
        if not categoria:
            return jsonify({'success': False, 'message': 'La categoría es obligatoria.'}), 400
        if not ubicacion:
            return jsonify({'success': False, 'message': 'La ubicación es obligatoria.'}), 400
        if not experiencia:
            return jsonify({'success': False, 'message': 'La experiencia es obligatoria.'}), 400

        # Convertir precio a decimal si existe
        precio_decimal = None
        if precio:
            try:
                precio_decimal = float(precio)
            except ValueError:
                return jsonify({'success': False, 'message': 'El precio debe ser un número válido.'}), 400

        # Convertir experiencia a entero
        try:
            experiencia_int = int(experiencia)
        except ValueError:
            return jsonify({'success': False, 'message': 'La experiencia debe ser un número válido.'}), 400

        # Insertar la publicación
        sql_insert = """
            INSERT INTO Publicaciones (UsuarioId, Titulo, Descripcion, Categoria, Precio, Ubicacion, 
                                     Experiencia, Habilidades, Disponibilidad, IncluyeMateriales, TipoPrecio) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        cursor.execute(sql_insert, (user_id, titulo, descripcion, categoria, precio_decimal, ubicacion, 
                                  experiencia_int, habilidades, disponibilidad, incluye_materiales, tipo_precio))
        conn.commit()

        return jsonify({'success': True, 'message': 'Publicación creada exitosamente.'}), 200

    except pyodbc.Error as ex:
        sqlstate = ex.args[0]
        print(f"Error de base de datos al crear publicación (sqlstate: {sqlstate}): {ex}")
        return jsonify({'success': False, 'message': f"Ocurrió un error en la base de datos: {ex}"}), 500
    except Exception as e:
        print(f"Error inesperado al crear publicación: {e}")
        return jsonify({'success': False, 'message': f"Ocurrió un error inesperado: {e}"}), 500
    finally:
        if conn:
            conn.close()

# Ruta para obtener las publicaciones del usuario actual (para "Mis Publicaciones")
@app.route('/mis_publicaciones', methods=['GET'])
def mis_publicaciones():
    if 'usuario_autenticado' not in session or not session['usuario_autenticado']:
        return jsonify({'success': False, 'message': 'No autenticado'}), 401

    user_id = session.get('user_id')
    tipo_usuario = session.get('tipo_usuario')

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        if tipo_usuario == 'prestador':
            # Obtener publicaciones del prestador
            cursor.execute("""
                SELECT id, Titulo, Descripcion, Categoria, Precio, Ubicacion, Experiencia, 
                       Habilidades, Disponibilidad, IncluyeMateriales, TipoPrecio, FechaCreacion, Activa
                FROM Publicaciones 
                WHERE UsuarioId = ?
                ORDER BY FechaCreacion DESC
            """, (user_id,))
        else:
            # Cliente viendo publicaciones (si es necesario)
            cursor.execute("""
                SELECT id, Titulo, Descripcion, Categoria, Precio, Ubicacion, Experiencia, 
                       Habilidades, Disponibilidad, IncluyeMateriales, TipoPrecio, FechaCreacion, Activa
                FROM Publicaciones 
                WHERE Activa = 1
                ORDER BY FechaCreacion DESC
            """)

        publicaciones = cursor.fetchall()
        publicaciones_list = []

        for pub in publicaciones:
            publicaciones_list.append({
                'id': pub[0],
                'titulo': pub[1],
                'descripcion': pub[2],
                'categoria': pub[3],
                'precio': float(pub[4]) if pub[4] else None,
                'ubicacion': pub[5],
                'experiencia': pub[6],
                'habilidades': pub[7],
                'disponibilidad': pub[8],
                'incluye_materiales': bool(pub[9]),
                'tipo_precio': pub[10],
                'fecha_creacion': pub[11].strftime('%d/%m/%Y %H:%M') if pub[11] else '',
                'activa': bool(pub[12])
            })

        return jsonify({'success': True, 'publicaciones': publicaciones_list}), 200

    except pyodbc.Error as ex:
        sqlstate = ex.args[0]
        print(f"Error de base de datos al obtener publicaciones (sqlstate: {sqlstate}): {ex}")
        return jsonify({'success': False, 'message': f"Error de base de datos: {ex}"}), 500
    except Exception as e:
        print(f"Error inesperado al obtener publicaciones: {e}")
        return jsonify({'success': False, 'message': f"Error inesperado: {e}"}), 500
    finally:
        if conn:
            conn.close()

# Ruta para obtener todas las publicaciones activas (para clientes)
@app.route('/publicaciones_activas', methods=['GET'])
def publicaciones_activas():
    if 'usuario_autenticado' not in session or not session['usuario_autenticado']:
        return jsonify({'success': False, 'message': 'No autenticado'}), 401

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Obtener todas las publicaciones activas con información del prestador
        cursor.execute("""
            SELECT p.id, p.Titulo, p.Descripcion, p.Categoria, p.Precio, p.Ubicacion, 
                   p.Experiencia, p.Habilidades, p.Disponibilidad, p.IncluyeMateriales, 
                   p.TipoPrecio, p.FechaCreacion,
                   per.Nombre, per.ApellidoP, per.ApellidoM, per.Telefono,
                   u.Email
            FROM Publicaciones p
            INNER JOIN Usuarios u ON p.UsuarioId = u.id
            INNER JOIN Personas per ON u.id = per.UsuarioId
            WHERE p.Activa = 1
            ORDER BY p.FechaCreacion DESC
        """)

        publicaciones = cursor.fetchall()
        publicaciones_list = []

        for pub in publicaciones:
            precio_texto = f"${pub[4]}" if pub[4] else "Consultar precio"
            if pub[4] and pub[10]:  # Si hay precio y tipo de precio
                tipo_precio_map = {
                    'hora': '/hora',
                    'servicio': '/servicio',
                    'dia': '/día',
                    'proyecto': '/proyecto'
                }
                precio_texto = f"${pub[4]}{tipo_precio_map.get(pub[10], '')}"

            publicaciones_list.append({
                'id': pub[0],
                'titulo': pub[1],
                'descripcion': pub[2],
                'categoria': pub[3],
                'precio': float(pub[4]) if pub[4] else None,
                'precio_texto': precio_texto,
                'ubicacion': pub[5],
                'experiencia': pub[6],
                'habilidades': pub[7],
                'disponibilidad': pub[8],
                'incluye_materiales': bool(pub[9]),
                'tipo_precio': pub[10],
                'fecha_creacion': pub[11].strftime('%d/%m/%Y') if pub[11] else '',
                'prestador_nombre': f"{pub[12]} {pub[13]} {pub[14]}",
                'prestador_telefono': pub[15],
                'prestador_email': pub[16]
            })

        return jsonify({'success': True, 'publicaciones': publicaciones_list}), 200

    except pyodbc.Error as ex:
        sqlstate = ex.args[0]
        print(f"Error de base de datos al obtener publicaciones activas (sqlstate: {sqlstate}): {ex}")
        return jsonify({'success': False, 'message': f"Error de base de datos: {ex}"}), 500
    except Exception as e:
        print(f"Error inesperado al obtener publicaciones activas: {e}")
        return jsonify({'success': False, 'message': f"Error inesperado: {e}"}), 500
    finally:
        if conn:
            conn.close()

# Ruta para activar/desactivar una publicación
@app.route('/toggle_publicacion/<int:publicacion_id>', methods=['POST'])
def toggle_publicacion(publicacion_id):
    if 'usuario_autenticado' not in session or not session['usuario_autenticado']:
        return jsonify({'success': False, 'message': 'No autenticado'}), 401

    user_id = session.get('user_id')

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Verificar que la publicación pertenece al usuario
        cursor.execute("SELECT Activa FROM Publicaciones WHERE id = ? AND UsuarioId = ?", (publicacion_id, user_id))
        publicacion = cursor.fetchone()

        if not publicacion:
            return jsonify({'success': False, 'message': 'Publicación no encontrada o no tienes permisos.'}), 404

        nuevo_estado = not publicacion[0]  # Cambiar el estado actual
        cursor.execute("UPDATE Publicaciones SET Activa = ? WHERE id = ?", (nuevo_estado, publicacion_id))
        conn.commit()

        estado_texto = "activada" if nuevo_estado else "desactivada"
        return jsonify({'success': True, 'message': f'Publicación {estado_texto} exitosamente.'}), 200

    except pyodbc.Error as ex:
        sqlstate = ex.args[0]
        print(f"Error de base de datos al cambiar estado de publicación (sqlstate: {sqlstate}): {ex}")
        return jsonify({'success': False, 'message': f"Error de base de datos: {ex}"}), 500
    except Exception as e:
        print(f"Error inesperado al cambiar estado de publicación: {e}")
        return jsonify({'success': False, 'message': f"Error inesperado: {e}"}), 500
    finally:
        if conn:
            conn.close()

# ==================== NUEVAS RUTAS PARA DETALLES, BÚSQUEDA Y SOLICITUDES ====================

# Ruta para obtener detalles completos de una publicación
@app.route('/detalles_publicacion/<int:publicacion_id>', methods=['GET'])
def detalles_publicacion(publicacion_id):
    if 'usuario_autenticado' not in session or not session['usuario_autenticado']:
        return jsonify({'success': False, 'message': 'No autenticado'}), 401

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Obtener detalles completos de la publicación con información del prestador
        cursor.execute("""
            SELECT p.id, p.Titulo, p.Descripcion, p.Categoria, p.Precio, p.Ubicacion, 
                   p.Experiencia, p.Habilidades, p.Disponibilidad, p.IncluyeMateriales, 
                   p.TipoPrecio, p.FechaCreacion,
                   per.Nombre, per.ApellidoP, per.ApellidoM, per.Telefono,
                   u.Email, u.id as PrestadorId
            FROM Publicaciones p
            INNER JOIN Usuarios u ON p.UsuarioId = u.id
            INNER JOIN Personas per ON u.id = per.UsuarioId
            WHERE p.id = ? AND p.Activa = 1
        """, (publicacion_id,))

        publicacion = cursor.fetchone()

        if not publicacion:
            return jsonify({'success': False, 'message': 'Publicación no encontrada.'}), 404

        # Formatear los datos de la publicación
        precio_texto = f"${publicacion[4]}" if publicacion[4] else "Consultar precio"
        if publicacion[4] and publicacion[10]:  # Si hay precio y tipo de precio
            tipo_precio_map = {
                'hora': '/hora',
                'servicio': '/servicio',
                'dia': '/día',
                'proyecto': '/proyecto'
            }
            precio_texto = f"${publicacion[4]}{tipo_precio_map.get(publicacion[10], '')}"

        publicacion_detalles = {
            'id': publicacion[0],
            'titulo': publicacion[1],
            'descripcion': publicacion[2],
            'categoria': publicacion[3],
            'precio': float(publicacion[4]) if publicacion[4] else None,
            'precio_texto': precio_texto,
            'ubicacion': publicacion[5],
            'experiencia': publicacion[6],
            'habilidades': publicacion[7],
            'disponibilidad': publicacion[8],
            'incluye_materiales': bool(publicacion[9]),
            'tipo_precio': publicacion[10],
            'fecha_creacion': publicacion[11].strftime('%d/%m/%Y') if publicacion[11] else '',
            'prestador_nombre': f"{publicacion[12]} {publicacion[13]} {publicacion[14]}",
            'prestador_telefono': publicacion[15],
            'prestador_email': publicacion[16],
            'prestador_id': publicacion[17]
        }

        return jsonify({'success': True, 'publicacion': publicacion_detalles}), 200

    except pyodbc.Error as ex:
        sqlstate = ex.args[0]
        print(f"Error de base de datos al obtener detalles de publicación (sqlstate: {sqlstate}): {ex}")
        return jsonify({'success': False, 'message': f"Error de base de datos: {ex}"}), 500
    except Exception as e:
        print(f"Error inesperado al obtener detalles de publicación: {e}")
        return jsonify({'success': False, 'message': f"Error inesperado: {e}"}), 500
    finally:
        if conn:
            conn.close()

# Ruta para buscar publicaciones con filtros
@app.route('/buscar_publicaciones', methods=['GET'])
def buscar_publicaciones():
    if 'usuario_autenticado' not in session or not session['usuario_autenticado']:
        return jsonify({'success': False, 'message': 'No autenticado'}), 401

    # Obtener parámetros de búsqueda
    query = request.args.get('q', '').strip()
    categoria = request.args.get('categoria', '').strip()
    precio_max = request.args.get('precio_max', '').strip()
    experiencia_min = request.args.get('experiencia_min', '').strip()

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Construir la consulta base
        sql = """
            SELECT p.id, p.Titulo, p.Descripcion, p.Categoria, p.Precio, p.Ubicacion, 
                   p.Experiencia, p.Habilidades, p.Disponibilidad, p.IncluyeMateriales, 
                   p.TipoPrecio, p.FechaCreacion,
                   per.Nombre, per.ApellidoP, per.ApellidoM, per.Telefono,
                   u.Email
            FROM Publicaciones p
            INNER JOIN Usuarios u ON p.UsuarioId = u.id
            INNER JOIN Personas per ON u.id = per.UsuarioId
            WHERE p.Activa = 1
        """

        params = []

        # Aplicar filtros
        if query:
            sql += " AND (p.Titulo LIKE ? OR p.Descripcion LIKE ? OR p.Habilidades LIKE ?)"
            params.extend([f'%{query}%', f'%{query}%', f'%{query}%'])

        if categoria:
            sql += " AND p.Categoria = ?"
            params.append(categoria)

        if precio_max:
            try:
                precio_max_float = float(precio_max)
                sql += " AND (p.Precio <= ? OR p.Precio IS NULL)"
                params.append(precio_max_float)
            except ValueError:
                pass

        if experiencia_min:
            try:
                experiencia_min_int = int(experiencia_min)
                sql += " AND p.Experiencia >= ?"
                params.append(experiencia_min_int)
            except ValueError:
                pass

        # Ordenar por fecha de creación (más recientes primero)
        sql += " ORDER BY p.FechaCreacion DESC"

        cursor.execute(sql, params)
        publicaciones = cursor.fetchall()

        publicaciones_list = []

        for pub in publicaciones:
            precio_texto = f"${pub[4]}" if pub[4] else "Consultar precio"
            if pub[4] and pub[10]:  # Si hay precio y tipo de precio
                tipo_precio_map = {
                    'hora': '/hora',
                    'servicio': '/servicio',
                    'dia': '/día',
                    'proyecto': '/proyecto'
                }
                precio_texto = f"${pub[4]}{tipo_precio_map.get(pub[10], '')}"

            publicaciones_list.append({
                'id': pub[0],
                'titulo': pub[1],
                'descripcion': pub[2],
                'categoria': pub[3],
                'precio': float(pub[4]) if pub[4] else None,
                'precio_texto': precio_texto,
                'ubicacion': pub[5],
                'experiencia': pub[6],
                'habilidades': pub[7],
                'disponibilidad': pub[8],
                'incluye_materiales': bool(pub[9]),
                'tipo_precio': pub[10],
                'fecha_creacion': pub[11].strftime('%d/%m/%Y') if pub[11] else '',
                'prestador_nombre': f"{pub[12]} {pub[13]} {pub[14]}",
                'prestador_telefono': pub[15],
                'prestador_email': pub[16]
            })

        return jsonify({'success': True, 'publicaciones': publicaciones_list}), 200

    except pyodbc.Error as ex:
        sqlstate = ex.args[0]
        print(f"Error de base de datos al buscar publicaciones (sqlstate: {sqlstate}): {ex}")
        return jsonify({'success': False, 'message': f"Error de base de datos: {ex}"}), 500
    except Exception as e:
        print(f"Error inesperado al buscar publicaciones: {e}")
        return jsonify({'success': False, 'message': f"Error inesperado: {e}"}), 500
    finally:
        if conn:
            conn.close()

# Ruta para enviar una solicitud de servicio
@app.route('/enviar_solicitud', methods=['POST'])
def enviar_solicitud():
    if 'usuario_autenticado' not in session or not session['usuario_autenticado']:
        return jsonify({'success': False, 'message': 'No autenticado'}), 401

    user_id = session.get('user_id')
    tipo_usuario = session.get('tipo_usuario')

    # Solo clientes pueden enviar solicitudes
    if tipo_usuario != 'cliente':
        return jsonify({'success': False, 'message': 'Solo los clientes pueden enviar solicitudes.'}), 403

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Obtener datos del formulario
        publicacion_id = request.form.get('publicacion_id', '').strip()
        fecha_servicio = request.form.get('fecha_servicio', '').strip()
        hora_servicio = request.form.get('hora_servicio', '').strip()
        mensaje = request.form.get('mensaje', '').strip()

        # Validaciones
        if not publicacion_id:
            return jsonify({'success': False, 'message': 'ID de publicación es obligatorio.'}), 400
        if not fecha_servicio:
            return jsonify({'success': False, 'message': 'La fecha del servicio es obligatoria.'}), 400

        # Verificar que la publicación existe y obtener el ID del prestador
        cursor.execute("SELECT UsuarioId FROM Publicaciones WHERE id = ? AND Activa = 1", (publicacion_id,))
        publicacion = cursor.fetchone()

        if not publicacion:
            return jsonify({'success': False, 'message': 'Publicación no encontrada o no activa.'}), 404

        prestador_id = publicacion[0]

        # Insertar la solicitud
        sql_insert = """
            INSERT INTO SolicitudesServicios (PublicacionId, ClienteId, PrestadorId, FechaServicio, HoraServicio, MensajeCliente, Estado)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """
        cursor.execute(sql_insert, (publicacion_id, user_id, prestador_id, fecha_servicio, hora_servicio, mensaje, 'pendiente'))
        conn.commit()

        return jsonify({'success': True, 'message': 'Solicitud enviada exitosamente.'}), 200

    except pyodbc.Error as ex:
        sqlstate = ex.args[0]
        print(f"Error de base de datos al enviar solicitud (sqlstate: {sqlstate}): {ex}")
        return jsonify({'success': False, 'message': f"Ocurrió un error en la base de datos: {ex}"}), 500
    except Exception as e:
        print(f"Error inesperado al enviar solicitud: {e}")
        return jsonify({'success': False, 'message': f"Ocurrió un error inesperado: {e}"}), 500
    finally:
        if conn:
            conn.close()

# Ruta para obtener las solicitudes del prestador
@app.route('/mis_solicitudes_prestador', methods=['GET'])
def mis_solicitudes_prestador():
    if 'usuario_autenticado' not in session or not session['usuario_autenticado']:
        return jsonify({'success': False, 'message': 'No autenticado'}), 401

    user_id = session.get('user_id')
    tipo_usuario = session.get('tipo_usuario')

    if tipo_usuario != 'prestador':
        return jsonify({'success': False, 'message': 'Solo los prestadores pueden ver solicitudes.'}), 403

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Obtener las solicitudes para el prestador
        cursor.execute("""
            SELECT s.id, s.FechaSolicitud, s.FechaServicio, s.HoraServicio, s.MensajeCliente, s.Estado,
                   p.Titulo, p.Precio, p.Categoria,
                   per.Nombre, per.ApellidoP, per.ApellidoM, per.Telefono,
                   u.Email
            FROM SolicitudesServicios s
            INNER JOIN Publicaciones p ON s.PublicacionId = p.id
            INNER JOIN Usuarios u ON s.ClienteId = u.id
            INNER JOIN Personas per ON u.id = per.UsuarioId
            WHERE s.PrestadorId = ?
            ORDER BY s.FechaSolicitud DESC
        """, (user_id,))

        solicitudes = cursor.fetchall()
        solicitudes_list = []

        for sol in solicitudes:
            solicitudes_list.append({
                'id': sol[0],
                'fecha_solicitud': sol[1].strftime('%d/%m/%Y %H:%M') if sol[1] else '',
                'fecha_servicio': sol[2].strftime('%d/%m/%Y') if sol[2] else '',
                'hora_servicio': sol[3].strftime('%H:%M') if sol[3] else '',
                'mensaje_cliente': sol[4],
                'estado': sol[5],
                'titulo_publicacion': sol[6],
                'precio': float(sol[7]) if sol[7] else None,
                'categoria': sol[8],
                'cliente_nombre': f"{sol[9]} {sol[10]} {sol[11]}",
                'cliente_telefono': sol[12],
                'cliente_email': sol[13]
            })

        return jsonify({'success': True, 'solicitudes': solicitudes_list}), 200

    except pyodbc.Error as ex:
        sqlstate = ex.args[0]
        print(f"Error de base de datos al obtener solicitudes (sqlstate: {sqlstate}): {ex}")
        return jsonify({'success': False, 'message': f"Error de base de datos: {ex}"}), 500
    except Exception as e:
        print(f"Error inesperado al obtener solicitudes: {e}")
        return jsonify({'success': False, 'message': f"Error inesperado: {e}"}), 500
    finally:
        if conn:
            conn.close()

# Ruta para obtener las solicitudes del cliente
@app.route('/mis_solicitudes_cliente', methods=['GET'])
def mis_solicitudes_cliente():
    if 'usuario_autenticado' not in session or not session['usuario_autenticado']:
        return jsonify({'success': False, 'message': 'No autenticado'}), 401

    user_id = session.get('user_id')
    tipo_usuario = session.get('tipo_usuario')

    if tipo_usuario != 'cliente':
        return jsonify({'success': False, 'message': 'Solo los clientes pueden ver sus solicitudes.'}), 403

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Obtener las solicitudes del cliente
        cursor.execute("""
            SELECT s.id, s.FechaSolicitud, s.FechaServicio, s.HoraServicio, s.MensajeCliente, s.Estado,
                   p.Titulo, p.Precio, p.Categoria,
                   per.Nombre, per.ApellidoP, per.ApellidoM, per.Telefono,
                   u.Email
            FROM SolicitudesServicios s
            INNER JOIN Publicaciones p ON s.PublicacionId = p.id
            INNER JOIN Usuarios u ON s.PrestadorId = u.id
            INNER JOIN Personas per ON u.id = per.UsuarioId
            WHERE s.ClienteId = ?
            ORDER BY s.FechaSolicitud DESC
        """, (user_id,))

        solicitudes = cursor.fetchall()
        solicitudes_list = []

        for sol in solicitudes:
            solicitudes_list.append({
                'id': sol[0],
                'fecha_solicitud': sol[1].strftime('%d/%m/%Y %H:%M') if sol[1] else '',
                'fecha_servicio': sol[2].strftime('%d/%m/%Y') if sol[2] else '',
                'hora_servicio': sol[3].strftime('%H:%M') if sol[3] else '',
                'mensaje_cliente': sol[4],
                'estado': sol[5],
                'titulo_publicacion': sol[6],
                'precio': float(sol[7]) if sol[7] else None,
                'categoria': sol[8],
                'prestador_nombre': f"{sol[9]} {sol[10]} {sol[11]}",
                'prestador_telefono': sol[12],
                'prestador_email': sol[13]
            })

        return jsonify({'success': True, 'solicitudes': solicitudes_list}), 200

    except pyodbc.Error as ex:
        sqlstate = ex.args[0]
        print(f"Error de base de datos al obtener solicitudes (sqlstate: {sqlstate}): {ex}")
        return jsonify({'success': False, 'message': f"Error de base de datos: {ex}"}), 500
    except Exception as e:
        print(f"Error inesperado al obtener solicitudes: {e}")
        return jsonify({'success': False, 'message': f"Error inesperado: {e}"}), 500
    finally:
        if conn:
            conn.close()

# ==================== RUTAS PARA LA AGENDA ====================



# Ruta para debug de solicitudes
@app.route('/debug_solicitudes', methods=['GET'])
def debug_solicitudes():
    if 'usuario_autenticado' not in session:
        return jsonify({'error': 'No autenticado'}), 401
    
    user_id = session.get('user_id')
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # 1. Verificar usuario
        cursor.execute("SELECT id, Email FROM Usuarios WHERE id = ?", (user_id,))
        usuario = cursor.fetchone()
        
        # 2. Verificar solicitudes aceptadas
        cursor.execute("""
            SELECT id, Estado, PrestadorId, ClienteId, FechaAceptacion, FechaServicio, HoraServicio
            FROM SolicitudesServicios 
            WHERE PrestadorId = ? AND Estado = 'aceptada'
        """, (user_id,))
        solicitudes = cursor.fetchall()
        
        return jsonify({
            'usuario': {
                'id': usuario[0] if usuario else None,
                'email': usuario[1] if usuario else None
            },
            'solicitudes_aceptadas': [
                {
                    'id': s[0],
                    'estado': s[1],
                    'prestador_id': s[2],
                    'cliente_id': s[3],
                    'fecha_aceptacion': s[4].strftime('%Y-%m-%d %H:%M:%S') if s[4] else None,
                    'fecha_servicio': s[5].strftime('%Y-%m-%d') if s[5] else None,
                    'hora_servicio': str(s[6]) if s[6] else None
                } for s in solicitudes
            ],
            'total_solicitudes': len(solicitudes)
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if conn:
            conn.close()

@app.route('/obtener_eventos_agenda', methods=['GET'])
def obtener_eventos_agenda():
    # Debug y verificación de sesión
    if 'usuario_autenticado' not in session or not session['usuario_autenticado']:
        return jsonify({'success': False, 'message': 'No autenticado', 'debug': {'session_user': None}}), 401

    user_id = session.get('user_id')
    tipo_usuario = session.get('tipo_usuario')

    # Solo prestadores
    if tipo_usuario != 'prestador':
        return jsonify({'success': False, 'message': 'Solo los prestadores pueden acceder a la agenda.', 'debug': {'session_user': user_id, 'tipo_usuario': tipo_usuario}}), 403

    print(f"DEBUG: Obteniendo eventos para el usuario de sesión user_id={user_id}, tipo_usuario={tipo_usuario}")

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT 
                s.id as solicitud_id,
                s.FechaAceptacion,
                s.FechaServicio,
                s.HoraServicio,
                s.Estado,
                p.Titulo as titulo_publicacion,
                per.Nombre,
                per.ApellidoP,
                per.ApellidoM,
                s.MensajeCliente,
                p.Precio
            FROM SolicitudesServicios s
            INNER JOIN Publicaciones p ON s.PublicacionId = p.id
            INNER JOIN Usuarios u ON s.ClienteId = u.id
            INNER JOIN Personas per ON u.id = per.UsuarioId
            WHERE s.PrestadorId = ? AND s.Estado = 'aceptada'
            ORDER BY s.FechaServicio, s.HoraServicio
        """, (user_id,))

        filas = cursor.fetchall()
        print(f"DEBUG: filas obtenidas: {len(filas)}")
        for f in filas:
            print("DEBUG fila raw:", f, "types:", [type(x) for x in f])

        eventos_list = []
        for evento in filas:
            # indices según tu SELECT
            solicitud_id = evento[0]
            fecha_aceptacion_raw = evento[1]
            fecha_servicio_raw = evento[2]
            hora_servicio_raw = evento[3]
            titulo_publicacion = evento[5]
            cliente_nombre = f"{evento[6]} {evento[7]} {evento[8]}"
            mensaje_cliente = evento[9]
            precio_raw = evento[10]

            # Normalizar fecha_servicio (acepta date o string)
            if isinstance(fecha_servicio_raw, str):
                try:
                    fecha_servicio_date = datetime.strptime(fecha_servicio_raw.split(' ')[0], '%Y-%m-%d').date()
                except Exception:
                    fecha_servicio_date = fecha_servicio_raw
            else:
                fecha_servicio_date = fecha_servicio_raw

            # Normalizar hora_servicio (acepta time o string)
            hora_servicio = None
            if hora_servicio_raw:
                if isinstance(hora_servicio_raw, str):
                    try:
                        hora_servicio = datetime.strptime(hora_servicio_raw.split('.')[0], '%H:%M:%S').time()
                    except Exception:
                        hora_servicio = hora_servicio_raw
                else:
                    hora_servicio = hora_servicio_raw

            # Construir fecha inicio y fin
            if hora_servicio and isinstance(fecha_servicio_date, (datetime, )):
                fecha_inicio_dt = fecha_servicio_date if isinstance(fecha_servicio_date, datetime) else datetime.combine(fecha_servicio_date, hora_servicio)
            elif hora_servicio and not isinstance(fecha_servicio_date, datetime):
                # fecha_servicio_date is date
                fecha_inicio_dt = datetime.combine(fecha_servicio_date, hora_servicio)
            else:
                fecha_inicio_dt = fecha_servicio_date  # es date

            if isinstance(fecha_inicio_dt, datetime):
                start_val = fecha_inicio_dt.isoformat()
                end_val = (fecha_inicio_dt + timedelta(hours=2)).isoformat()
            else:
                start_val = fecha_inicio_dt.strftime('%Y-%m-%d')
                # Para eventos all-day usa la misma fecha (FullCalendar interpreta strings 'YYYY-MM-DD')
                end_val = start_val

            precio = f"${precio_raw}" if precio_raw else "Consultar precio"

            eventos_list.append({
                'id': f"solicitud_{solicitud_id}",
                'title': f"Trabajo: {titulo_publicacion}",
                'start': start_val,
                'end': end_val,
                'extendedProps': {
                    'tipo': 'trabajo_aceptado',
                    'solicitud_id': solicitud_id,
                    'cliente_nombre': cliente_nombre,
                    'descripcion': mensaje_cliente or 'Sin mensaje adicional',
                    'fecha_aceptacion': fecha_aceptacion_raw.strftime('%d/%m/%Y %H:%M') if isinstance(fecha_aceptacion_raw, datetime) else (fecha_aceptacion_raw or 'No especificada'),
                    'precio': precio,
                    'servicio': titulo_publicacion
                },
                'color': '#28a745',
                'textColor': '#ffffff',
                'allDay': (hora_servicio is None)
            })

        print(f"DEBUG: eventos procesados para el calendario: {len(eventos_list)}")
        # Además devolvemos info de debug para el frontend (temporalmente)
        return jsonify({'success': True, 'eventos': eventos_list, 'debug': {'session_user': user_id, 'filas_encontradas': len(filas)}}), 200

    except pyodbc.Error as ex:
        sqlstate = ex.args[0]
        print(f"Error de base de datos al obtener eventos de agenda (sqlstate: {sqlstate}): {ex}")
        return jsonify({'success': False, 'message': f"Error de base de datos: {ex}"}), 500
    except Exception as e:
        print(f"Error inesperado al obtener eventos de agenda: {e}")
        return jsonify({'success': False, 'message': f"Error inesperado: {e}"}), 500
    finally:
        if conn:
            conn.close()


# ruta de logout
@app.route('/logout')
def logout():
    session.clear() # limpia toda la sesión
    flash('Has cerrado sesión exitosamente.', 'info')
    return redirect('/')

# ruta de terminos y condiciones
@app.route('/terminos_y_condiciones')
def terminos_y_condiciones():
    return render_template('terminos_y_condiciones.html')

# ==================== RUTAS PARA EDITAR PUBLICACIONES ====================

@app.route('/obtener_publicacion/<int:publicacion_id>', methods=['GET'])
def obtener_publicacion(publicacion_id):
    if 'usuario_autenticado' not in session or not session['usuario_autenticado']:
        return jsonify({'success': False, 'message': 'No autenticado'}), 401

    user_id = session.get('user_id')

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Obtener los datos de la publicación verificando que pertenece al usuario
        cursor.execute("""
            SELECT id, Titulo, Descripcion, Categoria, Precio, Ubicacion, 
                   Experiencia, Habilidades, Disponibilidad, IncluyeMateriales, TipoPrecio
            FROM Publicaciones 
            WHERE id = ? AND UsuarioId = ?
        """, (publicacion_id, user_id))

        publicacion = cursor.fetchone()

        if not publicacion:
            return jsonify({'success': False, 'message': 'Publicación no encontrada o no tienes permisos.'}), 404

        publicacion_data = {
            'id': publicacion[0],
            'titulo': publicacion[1],
            'descripcion': publicacion[2],
            'categoria': publicacion[3],
            'precio': float(publicacion[4]) if publicacion[4] else None,
            'ubicacion': publicacion[5],
            'experiencia': publicacion[6],
            'habilidades': publicacion[7],
            'disponibilidad': publicacion[8],
            'incluye_materiales': bool(publicacion[9]),
            'tipo_precio': publicacion[10]
        }

        return jsonify({'success': True, 'publicacion': publicacion_data}), 200

    except pyodbc.Error as ex:
        sqlstate = ex.args[0]
        print(f"Error de base de datos al obtener publicación (sqlstate: {sqlstate}): {ex}")
        return jsonify({'success': False, 'message': f"Error de base de datos: {ex}"}), 500
    except Exception as e:
        print(f"Error inesperado al obtener publicación: {e}")
        return jsonify({'success': False, 'message': f"Error inesperado: {e}"}), 500
    finally:
        if conn:
            conn.close()

@app.route('/editar_publicacion/<int:publicacion_id>', methods=['POST'])
def editar_publicacion(publicacion_id):
    if 'usuario_autenticado' not in session or not session['usuario_autenticado']:
        return jsonify({'success': False, 'message': 'Por favor, inicia sesión para editar la publicación.'}), 401

    user_id = session.get('user_id')
    tipo_usuario = session.get('tipo_usuario')

    if tipo_usuario != 'prestador':
        return jsonify({'success': False, 'message': 'Solo los prestadores pueden editar publicaciones.'}), 403

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Verificar que la publicación pertenece al usuario
        cursor.execute("SELECT id FROM Publicaciones WHERE id = ? AND UsuarioId = ?", (publicacion_id, user_id))
        publicacion = cursor.fetchone()

        if not publicacion:
            return jsonify({'success': False, 'message': 'Publicación no encontrada o no tienes permisos para editarla.'}), 404

        # Obtener datos del formulario
        titulo = request.form.get('titulo', '').strip()
        descripcion = request.form.get('descripcion', '').strip()
        categoria = request.form.get('categoria', '').strip()
        precio = request.form.get('salario', '').strip()
        ubicacion = request.form.get('ubicacion', '').strip()
        experiencia = request.form.get('experiencia', '').strip()
        habilidades = request.form.get('habilidades', '').strip()
        disponibilidad = request.form.get('disponibilidad', '').strip()
        tipo_precio = request.form.get('tipo_precio', 'hora')
        incluye_materiales = request.form.get('incluye_materiales') == 'on'

        # Validaciones básicas
        if not titulo:
            return jsonify({'success': False, 'message': 'El título es obligatorio.'}), 400
        if not descripcion:
            return jsonify({'success': False, 'message': 'La descripción es obligatoria.'}), 400
        if not categoria:
            return jsonify({'success': False, 'message': 'La categoría es obligatoria.'}), 400
        if not ubicacion:
            return jsonify({'success': False, 'message': 'La ubicación es obligatoria.'}), 400
        if not experiencia:
            return jsonify({'success': False, 'message': 'La experiencia es obligatoria.'}), 400

        # Convertir precio a decimal si existe
        precio_decimal = None
        if precio:
            try:
                precio_decimal = float(precio)
            except ValueError:
                return jsonify({'success': False, 'message': 'El precio debe ser un número válido.'}), 400

        # Convertir experiencia a entero
        try:
            experiencia_int = int(experiencia)
        except ValueError:
            return jsonify({'success': False, 'message': 'La experiencia debe ser un número válido.'}), 400

        # Actualizar la publicación
        sql_update = """
            UPDATE Publicaciones 
            SET Titulo = ?, Descripcion = ?, Categoria = ?, Precio = ?, Ubicacion = ?, 
                Experiencia = ?, Habilidades = ?, Disponibilidad = ?, IncluyeMateriales = ?, TipoPrecio = ?
            WHERE id = ? AND UsuarioId = ?
        """
        cursor.execute(sql_update, (titulo, descripcion, categoria, precio_decimal, ubicacion, 
                                  experiencia_int, habilidades, disponibilidad, incluye_materiales, tipo_precio, 
                                  publicacion_id, user_id))
        conn.commit()

        return jsonify({'success': True, 'message': 'Publicación actualizada exitosamente.'}), 200

    except pyodbc.Error as ex:
        sqlstate = ex.args[0]
        print(f"Error de base de datos al editar publicación (sqlstate: {sqlstate}): {ex}")
        return jsonify({'success': False, 'message': f"Ocurrió un error en la base de datos: {ex}"}), 500
    except Exception as e:
        print(f"Error inesperado al editar publicación: {e}")
        return jsonify({'success': False, 'message': f"Ocurrió un error inesperado: {e}"}), 500
    finally:
        if conn:
            conn.close()

# -------------- AL FINAL DEL ARCHIVO ----------------
from flask import abort

@app.route('/<path:filename>')
def mostrar_pagina_estatica(filename):
    # Solo servir archivos estáticos con extensiones conocidas
    allowed_ext = ('.js', '.css', '.png', '.jpg', '.jpeg', '.svg', '.ico', '.html', '.json')
    if not any(filename.lower().endswith(ext) for ext in allowed_ext):
        # No permitir que rutas de API sean capturadas por esta función
        abort(404)
    return send_from_directory(app.root_path, filename)

if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5000)