import os
from flask import Flask, render_template, request, redirect, url_for, flash, session, jsonify, send_from_directory, abort
import pyodbc
from werkzeug.security import generate_password_hash, check_password_hash
from email_validator import validate_email, EmailNotValidError
from datetime import datetime, timedelta
import re
from flask_mail import Mail, Message

# configuración de la aplicación flask
app = Flask(__name__)

app.secret_key = 'albertolunarufino'

# CONFIGURACIÓN DE CORREO
app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 465
app.config['MAIL_USERNAME'] = os.environ.get('EMAIL_USER')
app.config['MAIL_PASSWORD'] = os.environ.get('EMAIL_PASSWORD')
app.config['MAIL_USE_TLS'] = False
app.config['MAIL_USE_SSL'] = True

mail = Mail(app)

# configuración de la conexión a la base de datos
DB_CONFIG = {
    'driver': '{ODBC Driver 18 for SQL Server}',
    'server': 'jobnest-db.cry4we02g7xi.us-east-2.rds.amazonaws.com,1433',
    'database': 'JobNest',
    'user': 'admin',
    'password': 'E322158b.',
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


def enviar_correo_bienvenida(email, tipo_usuario):
    if tipo_usuario == 'cliente':
        asunto = "Bienvenido a JobNest 🎉"
        cuerpo = f"""
        Hola 👋

        Tu cuenta como CLIENTE fue creada correctamente en JobNest.

        Ya puedes buscar prestadores, solicitar servicios y comenzar a usar la plataforma.

        ¡Bienvenido!
        """
    else:
        asunto = "Bienvenido a JobNest 🎉"
        cuerpo = f"""
        Hola 👋

        Tu cuenta como PRESTADOR fue creada correctamente en JobNest.

        Ya puedes ofrecer tus servicios y recibir solicitudes de clientes.

        ¡Bienvenido!
        """

    msg = Message(
        asunto,
        sender=app.config['MAIL_USERNAME'],
        recipients=[email]
    )
    msg.body = cuerpo
    mail.send(msg)


def enviar_correo_notificacion(destinatario, asunto, cuerpo):
    """Envía un correo de notificación genérico."""
    try:
        msg = Message(
            asunto,
            sender=app.config['MAIL_USERNAME'],
            recipients=[destinatario]
        )
        msg.body = cuerpo
        mail.send(msg)
        print(f"✅ Correo enviado a {destinatario}")
    except Exception as e:
        print(f"❌ Error al enviar correo a {destinatario}: {e}")


# carpeta para subir imágenes de perfil (si es necesario en el futuro)
UPLOAD_FOLDER = 'multimedia'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)


# funciones de validación
def is_valid_email(email):
    try:
        validate_email(email, check_deliverability=False)
        email_regex = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")
        return bool(email_regex.match(email))
    except EmailNotValidError:
        return False


def is_valid_password(password):
    min_length = 8
    has_upper_case = any(c.isupper() for c in password)
    has_number = any(c.isdigit() for c in password)
    has_special_char = any(c in "!@#$%^&*(),.?\":{}|<>" for c in password)

    if len(password) < min_length:
        return 'La contraseña debe tener al menos 8 caracteres.'
    if not has_upper_case:
        return 'La contraseña debe contener al menos una letra mayúscula.'
    if not has_number:
        return 'La contraseña debe contener al menos un número.'
    if not has_special_char:
        return 'La contraseña debe contener al menos un carácter especial (!@#$%^&*(),.?:{}|<>).'
    return ''


def is_valid_person_name_field(name, is_apellido=False):
    letters_spaces_accents_regex = re.compile(r"^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$")
    if not bool(letters_spaces_accents_regex.match(name)):
        return False
    if is_apellido and len(name.split()) > 1:
        return False
    return True


def is_valid_phone_number(phone):
    return re.fullmatch(r"^\d{10,20}$", phone)


# Rutas principales
@app.route('/')
def index():
    return render_template('index.html')


@app.route('/registro')
def mostrar_formulario_registro():
    return render_template('registro.html')


@app.route('/registrar_usuario_web', methods=['POST'])
def registrar_usuario_web():
    if request.method == 'POST':
        data = request.get_json()
        errors = {}

        email = data.get('email', '').strip()
        password = data.get('password', '').strip()
        confirm_password = data.get('confirmPassword', '').strip()
        user_type = data.get('userType', '').strip()
        terms_checked = data.get('termsCheck') == 'on'

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

        if not user_type:
            errors['userType'] = 'Selecciona un tipo de cuenta.'
        elif user_type not in ['prestador', 'cliente']:
            errors['userType'] = 'Tipo de cuenta no válido.'

        conn = None
        try:
            conn = get_db_connection()
            cursor = conn.cursor()

            cursor.execute("SELECT id FROM Usuarios WHERE Email = ?", (email,))
            if cursor.fetchone():
                errors['email'] = 'Este correo electrónico ya está registrado.'

            first_name = data.get('firstName', '').strip()
            last_name_p = data.get('lastNameP', '').strip()
            last_name_m = data.get('lastNameM', '').strip()
            candidate_phone = data.get('candidatePhone', '').strip()

            first_name = ' '.join(word.capitalize() for word in first_name.split())
            last_name_p = ' '.join(word.capitalize() for word in last_name_p.split())
            last_name_m = ' '.join(word.capitalize() for word in last_name_m.split())

            if not first_name:
                errors['firstName'] = 'El nombre es obligatorio.'
            elif not is_valid_person_name_field(first_name):
                errors['firstName'] = 'Solo se permiten letras, espacios y acentos en el nombre.'

            if not last_name_p:
                errors['lastNameP'] = 'El apellido paterno es obligatorio.'
            elif not is_valid_person_name_field(last_name_p, is_apellido=True):
                errors['lastNameP'] = 'Solo se permite un apellido en el campo de apellido paterno.'

            if not last_name_m:
                errors['lastNameM'] = 'El apellido materno es obligatorio.'
            elif not is_valid_person_name_field(last_name_m, is_apellido=True):
                errors['lastNameM'] = 'Solo se permite un apellido en el campo de apellido materno.'

            if candidate_phone and not is_valid_phone_number(candidate_phone):
                errors['candidatePhone'] = 'El número de teléfono debe contener entre 10 y 20 dígitos numéricos.'

            if errors:
                return jsonify({'success': False, 'errors': errors, 'message': 'Errores de validación.'}), 400

            conn.autocommit = False
            try:
                hashed_password = generate_password_hash(password)

                sql_query_usuario = "INSERT INTO Usuarios (Email, PasswordHash, Activo, CreadoEn, UltimoLogin) VALUES (?, ?, ?, ?, ?)"
                current_time = datetime.now()
                cursor.execute(sql_query_usuario, (email, hashed_password, 1, current_time, current_time))

                cursor.execute("SELECT id FROM Usuarios WHERE Email = ?", (email,))
                user_id = cursor.fetchone()[0]

                sql_query_persona = "INSERT INTO Personas (UsuarioId, Nombre, ApellidoP, ApellidoM, Telefono) VALUES (?, ?, ?, ?, ?)"
                cursor.execute(sql_query_persona, (user_id, first_name, last_name_p, last_name_m, candidate_phone if candidate_phone else None))

                if user_type == 'prestador':
                    sql_query_prestador = "INSERT INTO Prestadores (UsuarioId, Verificado, RatingPromedio, TotalResenas) VALUES (?, ?, ?, ?)"
                    cursor.execute(sql_query_prestador, (user_id, 0, 0.0, 0))

                conn.commit()
                print("Datos insertados y commit realizado con éxito.")

                try:
                    enviar_correo_bienvenida(email, user_type)
                except Exception as e:
                    print(f"Error enviando correo: {e}")

                return jsonify({'success': True, 'message': '¡Registro exitoso!'}), 200

            except Exception as inner_ex:
                conn.rollback()
                raise inner_ex

        except pyodbc.Error as ex:
            sqlstate = ex.args[0]
            print(f"Error de base de datos en registro (sqlstate: {sqlstate}): {ex}")
            if sqlstate == '23000':
                return jsonify({'success': False, 'message': 'El correo electrónico ya está registrado. por favor, utiliza otro.', 'errors': {'email': 'Este correo electrónico ya está registrado.'}}), 409
            else:
                return jsonify({'success': False, 'message': f"Ocurrió un error en la base de datos: {ex}"}), 500
        except Exception as e:
            print(f"Error inesperado en el servidor durante el registro: {e}")
            return jsonify({'success': False, 'message': f"Ocurrió un error inesperado en el servidor: {e}"}), 500
        finally:
            if conn:
                conn.autocommit = True
                conn.close()


@app.route('/iniciar_sesion')
def mostrar_formulario_inicio_sesion():
    return render_template('login.html')


@app.route('/login', methods=['POST'])
def login_usuario():
    if request.method == 'POST':
        print("\n--- Datos recibidos del formulario de login ---")
        for key, value in request.form.items():
            print(f"{key}: {value}")
        print("----------------------------------------------\n")

        correo = request.form.get('email', '').strip()
        contrasena_ingresada = request.form.get('password', '').strip()

        if not correo or not contrasena_ingresada:
            return jsonify({'success': False, 'message': 'Por favor, ingresa tu correo y contraseña.'}), 400

        conn = None
        try:
            conn = get_db_connection()
            cursor = conn.cursor()

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
                    cursor.execute("UPDATE Usuarios SET UltimoLogin = ? WHERE id = ?", (datetime.now(), user_id))
                    conn.commit()

                    cursor.execute("SELECT Nombre, ApellidoP, ApellidoM, Telefono FROM Personas WHERE UsuarioId = ?", (user_id,))
                    persona_data = cursor.fetchone()

                    cursor.execute("SELECT id FROM Prestadores WHERE UsuarioId = ?", (user_id,))
                    es_prestador = cursor.fetchone() is not None
                    tipo_usuario = 'prestador' if es_prestador else 'cliente'

                    session['usuario_autenticado'] = True
                    session['user_id'] = user_id
                    session['correo'] = correo_usuario
                    session['tipo_usuario'] = tipo_usuario
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

                    return jsonify({'success': True, 'message': '¡Bienvenido! has iniciado sesión exitosamente.'}), 200
                else:
                    print("Contraseña incorrecta.")
                    return jsonify({'success': False, 'message': 'Contraseña incorrecta. por favor, inténtalo de nuevo.'}), 401
            else:
                print("Correo electrónico no encontrado.")
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


@app.route('/dashboard')
def dashboard():
    if 'usuario_autenticado' not in session or not session['usuario_autenticado']:
        flash('Por favor, inicia sesión para acceder al dashboard.', 'info')
        return redirect(url_for('mostrar_formulario_inicio_sesion'))
    return render_template('dashboard.html')


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
            'tipo_usuario': session.get('tipo_usuario', 'cliente')
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

        if nombres:
            nombres = ' '.join(word.capitalize() for word in nombres.split())
        if apellido_paterno:
            apellido_paterno = ' '.join(word.capitalize() for word in apellido_paterno.split())
        if apellido_materno:
            apellido_materno = ' '.join(word.capitalize() for word in apellido_materno.split())

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
        cursor.execute("SELECT PasswordHash FROM Usuarios WHERE id = ?", (user_id,))
        resultado = cursor.fetchone()

        if resultado and check_password_hash(resultado[0], contrasena_actual):
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


# ==================== PUBLICACIONES ====================
@app.route('/crear_publicacion', methods=['POST'])
def crear_publicacion():
    if 'usuario_autenticado' not in session or not session['usuario_autenticado']:
        return jsonify({'success': False, 'message': 'Por favor, inicia sesión para crear una publicación.'}), 401

    user_id = session.get('user_id')
    tipo_usuario = session.get('tipo_usuario')
    if tipo_usuario != 'prestador':
        return jsonify({'success': False, 'message': 'Solo los prestadores pueden crear publicaciones.'}), 403

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

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

        precio_decimal = None
        if precio:
            try:
                precio_decimal = float(precio)
            except ValueError:
                return jsonify({'success': False, 'message': 'El precio debe ser un número válido.'}), 400

        try:
            experiencia_int = int(experiencia)
        except ValueError:
            return jsonify({'success': False, 'message': 'La experiencia debe ser un número válido.'}), 400

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
            cursor.execute("""
                SELECT id, Titulo, Descripcion, Categoria, Precio, Ubicacion, Experiencia,
                       Habilidades, Disponibilidad, IncluyeMateriales, TipoPrecio, FechaCreacion, Activa
                FROM Publicaciones
                WHERE UsuarioId = ?
                ORDER BY FechaCreacion DESC
            """, (user_id,))
        else:
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


@app.route('/publicaciones_activas', methods=['GET'])
def publicaciones_activas():
    if 'usuario_autenticado' not in session or not session['usuario_autenticado']:
        return jsonify({'success': False, 'message': 'No autenticado'}), 401

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
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
            if pub[4] and pub[10]:
                tipo_precio_map = {'hora': '/hora', 'servicio': '/servicio', 'dia': '/día', 'proyecto': '/proyecto'}
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


@app.route('/toggle_publicacion/<int:publicacion_id>', methods=['POST'])
def toggle_publicacion(publicacion_id):
    if 'usuario_autenticado' not in session or not session['usuario_autenticado']:
        return jsonify({'success': False, 'message': 'No autenticado'}), 401

    user_id = session.get('user_id')
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT Activa FROM Publicaciones WHERE id = ? AND UsuarioId = ?", (publicacion_id, user_id))
        publicacion = cursor.fetchone()
        if not publicacion:
            return jsonify({'success': False, 'message': 'Publicación no encontrada o no tienes permisos.'}), 404

        nuevo_estado = not publicacion[0]
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


# ==================== DETALLES, BÚSQUEDA Y SOLICITUDES ====================
@app.route('/detalles_publicacion/<int:publicacion_id>', methods=['GET'])
def detalles_publicacion(publicacion_id):
    if 'usuario_autenticado' not in session or not session['usuario_autenticado']:
        return jsonify({'success': False, 'message': 'No autenticado'}), 401

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
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

        precio_texto = f"${publicacion[4]}" if publicacion[4] else "Consultar precio"
        if publicacion[4] and publicacion[10]:
            tipo_precio_map = {'hora': '/hora', 'servicio': '/servicio', 'dia': '/día', 'proyecto': '/proyecto'}
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


@app.route('/buscar_publicaciones', methods=['GET'])
def buscar_publicaciones():
    if 'usuario_autenticado' not in session or not session['usuario_autenticado']:
        return jsonify({'success': False, 'message': 'No autenticado'}), 401

    query = request.args.get('q', '').strip()
    categoria = request.args.get('categoria', '').strip()
    precio_max = request.args.get('precio_max', '').strip()
    experiencia_min = request.args.get('experiencia_min', '').strip()

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
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

        sql += " ORDER BY p.FechaCreacion DESC"
        cursor.execute(sql, params)
        publicaciones = cursor.fetchall()

        publicaciones_list = []
        for pub in publicaciones:
            precio_texto = f"${pub[4]}" if pub[4] else "Consultar precio"
            if pub[4] and pub[10]:
                tipo_precio_map = {'hora': '/hora', 'servicio': '/servicio', 'dia': '/día', 'proyecto': '/proyecto'}
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


@app.route('/enviar_solicitud', methods=['POST'])
def enviar_solicitud():
    if 'usuario_autenticado' not in session or not session['usuario_autenticado']:
        return jsonify({'success': False, 'message': 'No autenticado'}), 401

    user_id = session.get('user_id')
    tipo_usuario = session.get('tipo_usuario')
    if tipo_usuario != 'cliente':
        return jsonify({'success': False, 'message': 'Solo los clientes pueden enviar solicitudes.'}), 403

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        publicacion_id = request.form.get('publicacion_id', '').strip()
        fecha_servicio = request.form.get('fecha_servicio', '').strip()
        hora_servicio = request.form.get('hora_servicio', '').strip()
        mensaje = request.form.get('mensaje', '').strip()

        if not publicacion_id:
            return jsonify({'success': False, 'message': 'ID de publicación es obligatorio.'}), 400
        if not fecha_servicio:
            return jsonify({'success': False, 'message': 'La fecha del servicio es obligatoria.'}), 400

        cursor.execute("SELECT UsuarioId FROM Publicaciones WHERE id = ? AND Activa = 1", (publicacion_id,))
        publicacion = cursor.fetchone()
        if not publicacion:
            return jsonify({'success': False, 'message': 'Publicación no encontrada o no activa.'}), 404
        prestador_id = publicacion[0]

        sql_insert = """
            INSERT INTO SolicitudesServicios (PublicacionId, ClienteId, PrestadorId, FechaServicio, HoraServicio, MensajeCliente, Estado)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """
        cursor.execute(sql_insert, (publicacion_id, user_id, prestador_id, fecha_servicio, hora_servicio, mensaje, 'pendiente'))
        conn.commit()

        # --- Enviar correo al prestador ---
        cursor.execute("SELECT Titulo FROM Publicaciones WHERE id = ?", (publicacion_id,))
        titulo_servicio = cursor.fetchone()[0]
        cursor.execute("SELECT Nombre, ApellidoP, ApellidoM FROM Personas WHERE UsuarioId = ?", (user_id,))
        cliente_nombre_row = cursor.fetchone()
        nombre_cliente = f"{cliente_nombre_row[0]} {cliente_nombre_row[1]} {cliente_nombre_row[2]}".strip()
        cursor.execute("SELECT Email FROM Usuarios WHERE id = ?", (prestador_id,))
        prestador_email = cursor.fetchone()[0]

        cuerpo = f"""
        Hola,

        Has recibido una nueva solicitud de servicio.

        Servicio: {titulo_servicio}
        Cliente: {nombre_cliente}
        Fecha solicitada: {fecha_servicio} {hora_servicio if hora_servicio else 'a convenir'}

        Ingresa a tu panel para revisar los detalles y aceptar o rechazar la solicitud.
        """
        enviar_correo_notificacion(prestador_email, "Nueva solicitud en JobNest", cuerpo)

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


# ==================== AGENDA ====================
@app.route('/debug_solicitudes', methods=['GET'])
def debug_solicitudes():
    if 'usuario_autenticado' not in session:
        return jsonify({'error': 'No autenticado'}), 401
    user_id = session.get('user_id')
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id, Email FROM Usuarios WHERE id = ?", (user_id,))
        usuario = cursor.fetchone()
        cursor.execute("""
            SELECT id, Estado, PrestadorId, ClienteId, FechaAceptacion, FechaServicio, HoraServicio
            FROM SolicitudesServicios
            WHERE PrestadorId = ? AND Estado = 'aceptada'
        """, (user_id,))
        solicitudes = cursor.fetchall()
        return jsonify({
            'usuario': {'id': usuario[0] if usuario else None, 'email': usuario[1] if usuario else None},
            'solicitudes_aceptadas': [{'id': s[0], 'estado': s[1], 'prestador_id': s[2], 'cliente_id': s[3],
                                       'fecha_aceptacion': s[4].strftime('%Y-%m-%d %H:%M:%S') if s[4] else None,
                                       'fecha_servicio': s[5].strftime('%Y-%m-%d') if s[5] else None,
                                       'hora_servicio': str(s[6]) if s[6] else None} for s in solicitudes],
            'total_solicitudes': len(solicitudes)
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if conn:
            conn.close()


@app.route('/obtener_eventos_agenda', methods=['GET'])
def obtener_eventos_agenda():
    if 'usuario_autenticado' not in session or not session['usuario_autenticado']:
        return jsonify({'success': False, 'message': 'No autenticado', 'debug': {'session_user': None}}), 401
    user_id = session.get('user_id')
    tipo_usuario = session.get('tipo_usuario')
    if tipo_usuario != 'prestador':
        return jsonify({'success': False, 'message': 'Solo los prestadores pueden acceder a la agenda.',
                        'debug': {'session_user': user_id, 'tipo_usuario': tipo_usuario}}), 403

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
        eventos_list = []
        for evento in filas:
            solicitud_id = evento[0]
            fecha_aceptacion_raw = evento[1]
            fecha_servicio_raw = evento[2]
            hora_servicio_raw = evento[3]
            titulo_publicacion = evento[5]
            cliente_nombre = f"{evento[6]} {evento[7]} {evento[8]}"
            mensaje_cliente = evento[9]
            precio_raw = evento[10]

            if isinstance(fecha_servicio_raw, str):
                try:
                    fecha_servicio_date = datetime.strptime(fecha_servicio_raw.split(' ')[0], '%Y-%m-%d').date()
                except Exception:
                    fecha_servicio_date = fecha_servicio_raw
            else:
                fecha_servicio_date = fecha_servicio_raw

            hora_servicio = None
            if hora_servicio_raw:
                if isinstance(hora_servicio_raw, str):
                    try:
                        hora_servicio = datetime.strptime(hora_servicio_raw.split('.')[0], '%H:%M:%S').time()
                    except Exception:
                        hora_servicio = hora_servicio_raw
                else:
                    hora_servicio = hora_servicio_raw

            if hora_servicio and isinstance(fecha_servicio_date, datetime):
                fecha_inicio_dt = fecha_servicio_date if isinstance(fecha_servicio_date, datetime) else datetime.combine(fecha_servicio_date, hora_servicio)
            elif hora_servicio and not isinstance(fecha_servicio_date, datetime):
                fecha_inicio_dt = datetime.combine(fecha_servicio_date, hora_servicio)
            else:
                fecha_inicio_dt = fecha_servicio_date

            if isinstance(fecha_inicio_dt, datetime):
                start_val = fecha_inicio_dt.isoformat()
                end_val = (fecha_inicio_dt + timedelta(hours=2)).isoformat()
            else:
                start_val = fecha_inicio_dt.strftime('%Y-%m-%d')
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
        cursor.execute("SELECT id FROM Publicaciones WHERE id = ? AND UsuarioId = ?", (publicacion_id, user_id))
        if not cursor.fetchone():
            return jsonify({'success': False, 'message': 'Publicación no encontrada o no tienes permisos para editarla.'}), 404

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

        precio_decimal = None
        if precio:
            try:
                precio_decimal = float(precio)
            except ValueError:
                return jsonify({'success': False, 'message': 'El precio debe ser un número válido.'}), 400

        try:
            experiencia_int = int(experiencia)
        except ValueError:
            return jsonify({'success': False, 'message': 'La experiencia debe ser un número válido.'}), 400

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


# ==================== CALIFICACIONES ====================
@app.route('/servicios_concluidos', methods=['GET'])
def servicios_concluidos():
    if 'usuario_autenticado' not in session or not session['usuario_autenticado']:
        return jsonify({'success': False, 'message': 'No autenticado'}), 401

    user_id = session['user_id']
    tipo = session['tipo_usuario']

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        if tipo == 'cliente':
            cursor.execute("""
                SELECT
                    s.id, p.Titulo,
                    per_pre.Nombre, per_pre.ApellidoP, per_pre.ApellidoM,
                    s.FechaServicio, p.Precio,
                    r_mia.Calificacion AS mi_calificacion,
                    r_mia.Comentario AS mi_comentario,
                    r_recibida.Calificacion AS calificacion_recibida,
                    r_recibida.Comentario AS comentario_recibido
                FROM SolicitudesServicios s
                INNER JOIN Publicaciones p ON s.PublicacionId = p.id
                INNER JOIN Usuarios u_pre ON s.PrestadorId = u_pre.id
                INNER JOIN Personas per_pre ON u_pre.id = per_pre.UsuarioId
                LEFT JOIN Resenas r_mia ON r_mia.SolicitudServicioId = s.id AND r_mia.RevisorId = ?
                LEFT JOIN Resenas r_recibida ON r_recibida.SolicitudServicioId = s.id AND r_recibida.EvaluadoId = ?
                WHERE s.ClienteId = ? AND s.Estado IN ('concluido', 'calificado')
                ORDER BY s.FechaServicio DESC
            """, (user_id, user_id, user_id))
        else:
            cursor.execute("""
                SELECT
                    s.id, p.Titulo,
                    per_cli.Nombre, per_cli.ApellidoP, per_cli.ApellidoM,
                    s.FechaServicio, p.Precio,
                    r_mia.Calificacion AS mi_calificacion,
                    r_mia.Comentario AS mi_comentario,
                    r_recibida.Calificacion AS calificacion_recibida,
                    r_recibida.Comentario AS comentario_recibido
                FROM SolicitudesServicios s
                INNER JOIN Publicaciones p ON s.PublicacionId = p.id
                INNER JOIN Usuarios u_cli ON s.ClienteId = u_cli.id
                INNER JOIN Personas per_cli ON u_cli.id = per_cli.UsuarioId
                LEFT JOIN Resenas r_mia ON r_mia.SolicitudServicioId = s.id AND r_mia.RevisorId = ?
                LEFT JOIN Resenas r_recibida ON r_recibida.SolicitudServicioId = s.id AND r_recibida.EvaluadoId = ?
                WHERE s.PrestadorId = ? AND s.Estado IN ('concluido', 'calificado')
                ORDER BY s.FechaServicio DESC
            """, (user_id, user_id, user_id))

        rows = cursor.fetchall()
        servicios = []
        for row in rows:
            servicios.append({
                'id': row[0],
                'titulo': row[1],
                'nombre_contratante': f"{row[2]} {row[3]} {row[4]}",
                'fecha_servicio': row[5].strftime('%d/%m/%Y') if row[5] else '',
                'precio': float(row[6]) if row[6] else None,
                'mi_calificacion': row[7],
                'mi_comentario': row[8],
                'calificacion_recibida': row[9],
                'comentario_recibido': row[10]
            })
        return jsonify({'success': True, 'servicios': servicios}), 200

    except Exception as e:
        print(f"Error en servicios_concluidos: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        if conn:
            conn.close()


@app.route('/calificar_servicio', methods=['POST'])
def calificar_servicio():
    if 'usuario_autenticado' not in session or not session['usuario_autenticado']:
        return jsonify({'success': False, 'message': 'No autenticado'}), 401

    data = request.get_json()
    solicitud_id = data.get('solicitud_id')
    calificacion = data.get('calificacion')
    comentario = data.get('comentario', '').strip()
    opcion_predeterminada = data.get('opcion_predeterminada', '')

    if not solicitud_id or not calificacion:
        return jsonify({'success': False, 'message': 'Faltan datos'}), 400

    user_id = session['user_id']
    tipo = session['tipo_usuario']

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT ClienteId, PrestadorId FROM SolicitudesServicios WHERE id = ?", (solicitud_id,))
        row = cursor.fetchone()
        if not row:
            return jsonify({'success': False, 'message': 'Solicitud no encontrada'}), 404

        cliente_id = row[0]
        prestador_id = row[1]

        if tipo == 'cliente':
            evaluado_id = prestador_id
        else:
            evaluado_id = cliente_id

        comentario_final = opcion_predeterminada
        if comentario:
            comentario_final += f"\n{comentario}" if comentario_final else comentario

        cursor.execute("""
            INSERT INTO Resenas (SolicitudServicioId, RevisorId, EvaluadoId, Calificacion, Comentario, CreadoEn)
            VALUES (?, ?, ?, ?, ?, GETDATE())
        """, (solicitud_id, user_id, evaluado_id, calificacion, comentario_final))

        # Enviar correo al evaluado
        cursor.execute("SELECT Email FROM Usuarios WHERE id = ?", (evaluado_id,))
        evaluado_email = cursor.fetchone()[0]
        asunto = "Has recibido una nueva calificación"
        cuerpo = f"""
        Hola,

        Alguien ha calificado tu servicio. Calificación: {calificacion} estrellas.
        Comentario: {comentario_final}

        Puedes ver los detalles en tu panel.
        """
        enviar_correo_notificacion(evaluado_email, asunto, cuerpo)

        cursor.execute("UPDATE SolicitudesServicios SET Estado = 'calificado' WHERE id = ?", (solicitud_id,))

        if tipo == 'cliente':
            cursor.execute("""
                SELECT AVG(Calificacion) FROM Resenas
                WHERE EvaluadoId = ? AND Calificacion IS NOT NULL
            """, (evaluado_id,))
            avg_rating = cursor.fetchone()[0] or 0.0
            cursor.execute("UPDATE Prestadores SET RatingPromedio = ? WHERE UsuarioId = ?", (avg_rating, evaluado_id))

        conn.commit()
        return jsonify({'success': True, 'message': 'Calificación guardada correctamente'}), 200

    except Exception as e:
        print(f"Error en calificar_servicio: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        if conn:
            conn.close()


# ==================== MENSAJES ====================
@app.route('/mis_conversaciones', methods=['GET'])
def mis_conversaciones():
    if 'usuario_autenticado' not in session or not session['usuario_autenticado']:
        return jsonify({'success': False, 'message': 'No autenticado'}), 401

    user_id = session['user_id']
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT h.id, h.SolicitudServicioId, p.Titulo, u.id AS otro_usuario_id,
                   per.Nombre, per.ApellidoP, per.ApellidoM,
                   (SELECT TOP 1 Cuerpo FROM Mensajes WHERE HiloId = h.id ORDER BY EnviadoEn DESC) AS ultimo_mensaje,
                   (SELECT TOP 1 EnviadoEn FROM Mensajes WHERE HiloId = h.id ORDER BY EnviadoEn DESC) AS ultimo_enviado
            FROM Hilos h
            INNER JOIN SolicitudesServicios ss ON h.SolicitudServicioId = ss.id
            INNER JOIN Publicaciones p ON ss.PublicacionId = p.id
            INNER JOIN Usuarios u ON (u.id = ss.ClienteId OR u.id = ss.PrestadorId) AND u.id != ?
            INNER JOIN Personas per ON u.id = per.UsuarioId
            WHERE ss.ClienteId = ? OR ss.PrestadorId = ?
            ORDER BY ultimo_enviado DESC
        """, (user_id, user_id, user_id))
        rows = cursor.fetchall()
        conversaciones = []
        for row in rows:
            conversaciones.append({
                'id': row[0],
                'solicitud_id': row[1],
                'titulo_publicacion': row[2],
                'otro_usuario_id': row[3],
                'otro_nombre': f"{row[4]} {row[5]} {row[6]}",
                'ultimo_mensaje': row[7],
                'ultimo_enviado': row[8].strftime('%d/%m/%Y %H:%M') if row[8] else ''
            })
        return jsonify({'success': True, 'conversaciones': conversaciones}), 200

    except Exception as e:
        print(f"Error en mis_conversaciones: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        if conn:
            conn.close()


@app.route('/obtener_mensajes/<int:hilo_id>', methods=['GET'])
def obtener_mensajes(hilo_id):
    if 'usuario_autenticado' not in session or not session['usuario_autenticado']:
        return jsonify({'success': False, 'message': 'No autenticado'}), 401

    user_id = session['user_id']
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT ss.ClienteId, ss.PrestadorId
            FROM Hilos h
            INNER JOIN SolicitudesServicios ss ON h.SolicitudServicioId = ss.id
            WHERE h.id = ?
        """, (hilo_id,))
        row = cursor.fetchone()
        if not row:
            return jsonify({'success': False, 'message': 'Hilo no encontrado'}), 404
        if row[0] != user_id and row[1] != user_id:
            return jsonify({'success': False, 'message': 'No tienes permiso'}), 403

        cursor.execute("""
            SELECT m.id, m.EmisorId, m.Cuerpo, m.EnviadoEn,
                   per.Nombre, per.ApellidoP, per.ApellidoM
            FROM Mensajes m
            LEFT JOIN Personas per ON m.EmisorId = per.UsuarioId
            WHERE m.HiloId = ?
            ORDER BY m.EnviadoEn ASC
        """, (hilo_id,))
        rows = cursor.fetchall()
        mensajes = []
        for row in rows:
            mensajes.append({
                'id': row[0],
                'emisor_id': row[1],
                'cuerpo': row[2],
                'enviado_en': row[3].strftime('%d/%m/%Y %H:%M') if row[3] else '',
                'emisor_nombre': f"{row[4]} {row[5]} {row[6]}".strip() if row[4] else 'Usuario'
            })
        return jsonify({'success': True, 'mensajes': mensajes}), 200

    except Exception as e:
        print(f"Error en obtener_mensajes: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        if conn:
            conn.close()


@app.route('/enviar_mensaje', methods=['POST'])
def enviar_mensaje():
    if 'usuario_autenticado' not in session or not session['usuario_autenticado']:
        return jsonify({'success': False, 'message': 'No autenticado'}), 401

    data = request.get_json()
    solicitud_id = data.get('solicitud_id')
    mensaje = data.get('mensaje', '').strip()
    hilo_id = data.get('hilo_id')

    if not mensaje:
        return jsonify({'success': False, 'message': 'El mensaje no puede estar vacío'}), 400

    user_id = session['user_id']

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        if hilo_id:
            cursor.execute("""
                SELECT ss.ClienteId, ss.PrestadorId
                FROM Hilos h
                INNER JOIN SolicitudesServicios ss ON h.SolicitudServicioId = ss.id
                WHERE h.id = ?
            """, (hilo_id,))
            row = cursor.fetchone()
            if not row or (row[0] != user_id and row[1] != user_id):
                return jsonify({'success': False, 'message': 'No tienes permiso'}), 403
        else:
            if not solicitud_id:
                return jsonify({'success': False, 'message': 'Se requiere solicitud_id'}), 400
            cursor.execute("SELECT ClienteId, PrestadorId FROM SolicitudesServicios WHERE id = ?", (solicitud_id,))
            row = cursor.fetchone()
            if not row or (row[0] != user_id and row[1] != user_id):
                return jsonify({'success': False, 'message': 'No participas en esta solicitud'}), 403

            cursor.execute("SELECT id FROM Hilos WHERE SolicitudServicioId = ?", (solicitud_id,))
            hilo = cursor.fetchone()
            if hilo:
                hilo_id = hilo[0]
            else:
                cursor.execute("INSERT INTO Hilos (SolicitudServicioId, CreadoEn) VALUES (?, GETDATE())", (solicitud_id,))
                hilo_id = cursor.execute("SELECT SCOPE_IDENTITY()").fetchone()[0]
                conn.commit()

        cursor.execute("""
            INSERT INTO Mensajes (HiloId, EmisorId, Cuerpo, EnviadoEn)
            VALUES (?, ?, ?, GETDATE())
        """, (hilo_id, user_id, mensaje))
        conn.commit()

        # --- Enviar correo al destinatario ---
        cursor.execute("""
            SELECT ss.ClienteId, ss.PrestadorId
            FROM Hilos h
            INNER JOIN SolicitudesServicios ss ON h.SolicitudServicioId = ss.id
            WHERE h.id = ?
        """, (hilo_id,))
        row = cursor.fetchone()
        if row:
            otro_id = row[0] if row[0] != user_id else row[1]
            cursor.execute("SELECT Email FROM Usuarios WHERE id = ?", (otro_id,))
            destinatario_email = cursor.fetchone()[0]
            cursor.execute("SELECT Nombre, ApellidoP, ApellidoM FROM Personas WHERE UsuarioId = ?", (user_id,))
            emisor_nombre_row = cursor.fetchone()
            nombre_emisor = f"{emisor_nombre_row[0]} {emisor_nombre_row[1]} {emisor_nombre_row[2]}".strip()
            cuerpo = f"""
            Tienes un nuevo mensaje en JobNest.

            De: {nombre_emisor}
            Mensaje: {mensaje}

            Responde desde tu panel.
            """
            enviar_correo_notificacion(destinatario_email, "Nuevo mensaje en JobNest", cuerpo)

        return jsonify({'success': True, 'message': 'Mensaje enviado', 'hilo_id': hilo_id}), 200

    except Exception as e:
        print(f"Error en enviar_mensaje: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        if conn:
            conn.close()


# ==================== PAGOS ====================
@app.route('/obtener_solicitudes_pendientes_pago', methods=['GET'])
def obtener_solicitudes_pendientes_pago():
    if 'usuario_autenticado' not in session or not session['usuario_autenticado']:
        return jsonify({'success': False, 'message': 'No autenticado'}), 401

    user_id = session['user_id']
    tipo = session['tipo_usuario']
    if tipo != 'cliente':
        return jsonify({'success': False, 'message': 'Solo los clientes pueden realizar pagos'}), 403

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT s.id, p.Titulo, s.FechaServicio, p.Precio, per.Nombre, per.ApellidoP, per.ApellidoM
            FROM SolicitudesServicios s
            INNER JOIN Publicaciones p ON s.PublicacionId = p.id
            INNER JOIN Usuarios u ON s.PrestadorId = u.id
            INNER JOIN Personas per ON u.id = per.UsuarioId
            LEFT JOIN Pagos pg ON s.id = pg.SolicitudServicioId AND pg.EstatusId = (SELECT id FROM Estatus WHERE Nombre = 'completado')
            WHERE s.ClienteId = ? AND s.Estado = 'aceptada' AND pg.id IS NULL
            ORDER BY s.FechaServicio ASC
        """, (user_id,))
        rows = cursor.fetchall()
        solicitudes = []
        for row in rows:
            solicitudes.append({
                'id': row[0],
                'titulo': row[1],
                'fecha_servicio': row[2].strftime('%d/%m/%Y') if row[2] else '',
                'precio': float(row[3]) if row[3] else 0,
                'prestador_nombre': f"{row[4]} {row[5]} {row[6]}"
            })
        return jsonify({'success': True, 'solicitudes': solicitudes}), 200

    except Exception as e:
        print(f"Error en obtener_solicitudes_pendientes_pago: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        if conn:
            conn.close()


@app.route('/procesar_pago', methods=['POST'])
def procesar_pago():
    if 'usuario_autenticado' not in session or not session['usuario_autenticado']:
        return jsonify({'success': False, 'message': 'No autenticado'}), 401

    data = request.get_json()
    solicitud_id = data.get('solicitud_id')
    metodo = data.get('metodo')
    monto = data.get('monto')

    if not solicitud_id or not metodo or not monto:
        return jsonify({'success': False, 'message': 'Datos incompletos'}), 400

    user_id = session['user_id']
    tipo = session['tipo_usuario']
    if tipo != 'cliente':
        return jsonify({'success': False, 'message': 'No autorizado'}), 403

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT s.id, p.Precio
            FROM SolicitudesServicios s
            INNER JOIN Publicaciones p ON s.PublicacionId = p.id
            LEFT JOIN Pagos pg ON s.id = pg.SolicitudServicioId AND pg.EstatusId = (SELECT id FROM Estatus WHERE Nombre = 'completado')
            WHERE s.id = ? AND s.ClienteId = ? AND s.Estado = 'aceptada' AND pg.id IS NULL
        """, (solicitud_id, user_id))
        row = cursor.fetchone()
        if not row:
            return jsonify({'success': False, 'message': 'La solicitud no es válida para pago'}), 400

        precio_esperado = float(row[1]) if row[1] else 0
        if monto != precio_esperado:
            return jsonify({'success': False, 'message': 'El monto no coincide con el precio del servicio'}), 400

        cursor.execute("SELECT id FROM MetodosPago WHERE Nombre = ?", (metodo.capitalize(),))
        metodo_row = cursor.fetchone()
        if not metodo_row:
            return jsonify({'success': False, 'message': 'Método de pago no válido'}), 400
        metodo_id = metodo_row[0]

        cursor.execute("SELECT id FROM Estatus WHERE Nombre = 'completado'")
        estatus_completado = cursor.fetchone()[0]

        if metodo == 'efectivo':
            cursor.execute("""
                INSERT INTO Pagos (SolicitudServicioId, Monto, Moneda, MetodoId, EstatusId, Procesador, PagadoEn, CreadoEn)
                VALUES (?, ?, 'MXN', ?, ?, 'Efectivo', GETDATE(), GETDATE())
            """, (solicitud_id, monto, metodo_id, estatus_completado))
            conn.commit()
            return jsonify({'success': True, 'message': 'Pago registrado exitosamente. El servicio ha sido pagado.'}), 200

        elif metodo == 'tarjeta':
            numero = data.get('numero')
            nombre = data.get('nombre')
            expiracion = data.get('expiracion')
            cvv = data.get('cvv')

            if not numero or not nombre or not expiracion or not cvv:
                return jsonify({'success': False, 'message': 'Todos los campos de la tarjeta son obligatorios'}), 400

            if not re.match(r'^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]{2,}$', nombre):
                return jsonify({'success': False, 'message': 'Nombre del titular inválido (solo letras y espacios)'}), 400

            numero = re.sub(r'[\s\-]', '', numero)
            if not re.match(r'^\d{13,19}$', numero):
                return jsonify({'success': False, 'message': 'Número de tarjeta inválido (debe tener entre 13 y 19 dígitos)'}), 400

            if not re.match(r'^\d{3,4}$', cvv):
                return jsonify({'success': False, 'message': 'CVV inválido (3 o 4 dígitos)'}), 400

            if not re.match(r'^(0[1-9]|1[0-2])\/\d{2}$', expiracion):
                return jsonify({'success': False, 'message': 'Formato de fecha inválido (MM/AA)'}), 400
            mes, anio = expiracion.split('/')
            anio_actual = datetime.now().year % 100
            mes_actual = datetime.now().month
            if int(anio) < anio_actual or (int(anio) == anio_actual and int(mes) < mes_actual):
                return jsonify({'success': False, 'message': 'Tarjeta expirada'}), 400

            transaccion_id = f"SIM-{solicitud_id}-{datetime.now().strftime('%Y%m%d%H%M%S')}"
            cursor.execute("""
                INSERT INTO Pagos (SolicitudServicioId, Monto, Moneda, MetodoId, EstatusId, Procesador, ProcesadorChargeId, PagadoEn, CreadoEn)
                VALUES (?, ?, 'MXN', ?, ?, 'Simulación', ?, GETDATE(), GETDATE())
            """, (solicitud_id, monto, metodo_id, estatus_completado, transaccion_id))
            conn.commit()
            return jsonify({'success': True, 'message': 'Pago procesado exitosamente', 'transaccion_id': transaccion_id}), 200

        else:
            return jsonify({'success': False, 'message': 'Método de pago no soportado'}), 400

    except Exception as e:
        print(f"Error en procesar_pago: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        if conn:
            conn.close()


# ==================== ACTUALIZAR ESTADO DE SOLICITUD ====================
@app.route('/actualizar_estado_solicitud/<int:solicitud_id>', methods=['POST'])
def actualizar_estado_solicitud(solicitud_id):
    if 'usuario_autenticado' not in session or not session['usuario_autenticado']:
        return jsonify({'success': False, 'message': 'No autenticado'}), 401

    data = request.get_json()
    nuevo_estado = data.get('estado')
    if nuevo_estado not in ['aceptada', 'rechazada']:
        return jsonify({'success': False, 'message': 'Estado no válido'}), 400

    user_id = session['user_id']
    tipo = session['tipo_usuario']
    if tipo != 'prestador':
        return jsonify({'success': False, 'message': 'Solo prestadores pueden actualizar estado'}), 403

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT id FROM SolicitudesServicios WHERE id = ? AND PrestadorId = ?", (solicitud_id, user_id))
        if not cursor.fetchone():
            return jsonify({'success': False, 'message': 'No tienes permiso para modificar esta solicitud'}), 403

        # Obtener datos para el correo antes de actualizar
        cursor.execute("""
            SELECT s.ClienteId, p.Titulo, per.Nombre, per.ApellidoP, per.ApellidoM
            FROM SolicitudesServicios s
            INNER JOIN Publicaciones p ON s.PublicacionId = p.id
            INNER JOIN Personas per ON s.PrestadorId = per.UsuarioId
            WHERE s.id = ?
        """, (solicitud_id,))
        solicitud_info = cursor.fetchone()
        cliente_id = solicitud_info[0]
        titulo_servicio = solicitud_info[1]
        prestador_nombre = f"{solicitud_info[2]} {solicitud_info[3]} {solicitud_info[4]}".strip()

        cursor.execute("UPDATE SolicitudesServicios SET Estado = ?, FechaAceptacion = GETDATE() WHERE id = ?",
                       (nuevo_estado, solicitud_id))

        # Enviar correo al cliente
        cursor.execute("SELECT Email FROM Usuarios WHERE id = ?", (cliente_id,))
        cliente_email = cursor.fetchone()[0]

        if nuevo_estado == 'aceptada':
            asunto = "Solicitud aceptada"
            cuerpo = f"""
            Hola,

            Tu solicitud para el servicio "{titulo_servicio}" ha sido ACEPTADA por {prestador_nombre}.

            Puedes contactar al prestador desde la sección de Mensajes para coordinar los detalles.
            """
        else:
            asunto = "Solicitud rechazada"
            cuerpo = f"""
            Hola,

            Tu solicitud para el servicio "{titulo_servicio}" ha sido RECHAZADA por {prestador_nombre}.

            No te desanimes, hay más prestadores disponibles.
            """
        enviar_correo_notificacion(cliente_email, asunto, cuerpo)

        # SI LA SOLICITUD FUE ACEPTADA, CREAR HILO DE CONVERSACIÓN (si no existe)
        if nuevo_estado == 'aceptada':
            cursor.execute("SELECT id FROM Hilos WHERE SolicitudServicioId = ?", (solicitud_id,))
            hilo_existente = cursor.fetchone()
            if not hilo_existente:
                cursor.execute("INSERT INTO Hilos (SolicitudServicioId, CreadoEn) VALUES (?, GETDATE())", (solicitud_id,))
                hilo_id = cursor.execute("SELECT SCOPE_IDENTITY()").fetchone()[0]
                print(f"✅ Hilo creado automáticamente para la solicitud {solicitud_id} (ID de hilo: {hilo_id})")

                mensaje_bienvenida = f"✅ Solicitud aceptada para el servicio: {titulo_servicio}. Ahora pueden conversar para coordinar los detalles."
                cursor.execute("""
                    INSERT INTO Mensajes (HiloId, EmisorId, Cuerpo, EnviadoEn)
                    VALUES (?, NULL, ?, GETDATE())
                """, (hilo_id, mensaje_bienvenida))
                print(f"💬 Mensaje automático insertado en el hilo {hilo_id}")

        conn.commit()
        return jsonify({'success': True, 'message': f'Solicitud {nuevo_estado}'}), 200

    except Exception as e:
        print(f"Error en actualizar_estado_solicitud: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        if conn:
            conn.close()


@app.route('/marcar_concluido/<int:solicitud_id>', methods=['POST'])
def marcar_concluido(solicitud_id):
    if 'usuario_autenticado' not in session or not session['usuario_autenticado']:
        return jsonify({'success': False, 'message': 'No autenticado'}), 401

    user_id = session['user_id']
    tipo = session['tipo_usuario']
    if tipo != 'prestador':
        return jsonify({'success': False, 'message': 'Solo prestadores pueden marcar como concluido'}), 403

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM SolicitudesServicios WHERE id = ? AND PrestadorId = ? AND Estado = 'aceptada'",
                       (solicitud_id, user_id))
        if not cursor.fetchone():
            return jsonify({'success': False, 'message': 'Solicitud no encontrada o no está aceptada'}), 404

        cursor.execute("UPDATE SolicitudesServicios SET Estado = 'concluido' WHERE id = ?", (solicitud_id,))
        conn.commit()
        return jsonify({'success': True, 'message': 'Trabajo marcado como concluido'}), 200

    except Exception as e:
        print(f"Error en marcar_concluido: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        if conn:
            conn.close()


# ==================== CHATBOT ====================
def extraer_categoria_y_calificacion(mensaje):
    mensaje = mensaje.lower()
    categorias = {
        'plomero': 'plomeria',
        'electricista': 'electricidad',
        'carpintero': 'carpinteria',
        'jardinero': 'jardineria',
        'limpieza': 'limpieza',
        'reparaciones': 'reparaciones',
        'tecnologia': 'tecnologia',
        'diseño': 'diseno',
        'educacion': 'educacion',
        'bienestar': 'bienestar'
    }
    categoria = None
    for palabra, cat in categorias.items():
        if palabra in mensaje:
            categoria = cat
            break

    if any(p in mensaje for p in ['excelente', 'excelentes', 'mejor', 'recomendado']):
        calificacion_min = 4.5
        comentario_keyword = 'Excelente servicio'
    elif any(p in mensaje for p in ['buen', 'buena', 'bien', 'regular']):
        calificacion_min = 3.0
        comentario_keyword = 'Buen servicio'
    elif any(p in mensaje for p in ['aceptable', 'suficiente']):
        calificacion_min = 2.5
        comentario_keyword = 'Servicio aceptable'
    elif any(p in mensaje for p in ['mal', 'malo', 'pésimo', 'pésimo', 'deficiente']):
        calificacion_min = 1.0
        comentario_keyword = 'Mal servicio'
    else:
        calificacion_min = 4.0
        comentario_keyword = None

    return categoria, calificacion_min, comentario_keyword


@app.route('/chatbot', methods=['POST'])
def chatbot_mensaje():
    if 'usuario_autenticado' not in session or not session['usuario_autenticado']:
        return jsonify({'success': False, 'message': 'No autenticado'}), 401

    if session.get('tipo_usuario') != 'cliente':
        return jsonify({'success': False, 'message': 'Solo clientes pueden usar el chatbot'}), 403

    data = request.get_json()
    mensaje = data.get('mensaje', '').strip()
    if not mensaje:
        return jsonify({'success': False, 'message': 'Mensaje vacío'}), 400

    categoria, calificacion_min, comentario_keyword = extraer_categoria_y_calificacion(mensaje)

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        sql = """
            SELECT
                u.id, p.Nombre, p.ApellidoP, p.ApellidoM,
                pr.RatingPromedio,
                (SELECT TOP 1 Comentario FROM Resenas WHERE EvaluadoId = u.id ORDER BY CreadoEn DESC) as ultimo_comentario
            FROM Prestadores pr
            INNER JOIN Usuarios u ON pr.UsuarioId = u.id
            INNER JOIN Personas p ON u.id = p.UsuarioId
            WHERE pr.RatingPromedio >= ?
        """
        params = [calificacion_min]

        if categoria:
            sql += " AND EXISTS (SELECT 1 FROM Publicaciones pub WHERE pub.UsuarioId = u.id AND pub.Categoria = ? AND pub.Activa = 1)"
            params.append(categoria)

        if comentario_keyword:
            sql += " AND EXISTS (SELECT 1 FROM Resenas r WHERE r.EvaluadoId = u.id AND r.Comentario LIKE ?)"
            params.append(f'%{comentario_keyword}%')

        sql += " ORDER BY pr.RatingPromedio DESC"

        cursor.execute(sql, params)
        rows = cursor.fetchall()

        if not rows:
            respuesta = f"Lo siento, no encontré prestadores de {categoria if categoria else 'servicios'} con {comentario_keyword if comentario_keyword else 'buena calificación'}. Intenta con otros criterios."
            return jsonify({'success': True, 'respuesta': respuesta, 'prestadores': []})

        prestadores_list = []
        for row in rows:
            nombre_completo = f"{row[1]} {row[2]} {row[3]}".strip()
            rating = float(row[4]) if row[4] else 0
            ultimo_comentario = row[5] if row[5] else ''
            prestadores_list.append({
                'id': row[0],
                'nombre': nombre_completo,
                'rating': rating,
                'ultimo_comentario': ultimo_comentario
            })

        texto = f"🔍 Encontré {len(prestadores_list)} prestador(es) con {comentario_keyword if comentario_keyword else 'buena calificación'}:\n\n"
        for i, p in enumerate(prestadores_list[:5], 1):
            texto += f"{i}. {p['nombre']} - ⭐ {p['rating']}\n   Comentario: {p['ultimo_comentario'][:80]}\n\n"
        if len(prestadores_list) > 5:
            texto += f"... y {len(prestadores_list)-5} más.\n"
        texto += "\n¿Quieres ver detalles de alguno? Escribe el número."

        return jsonify({'success': True, 'respuesta': texto, 'prestadores': prestadores_list})

    except Exception as e:
        print(f"Error en chatbot: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        if conn:
            conn.close()


# ==================== OTRAS RUTAS ====================
@app.route('/logout')
def logout():
    session.clear()
    flash('Has cerrado sesión exitosamente.', 'info')
    return redirect('/')


@app.route('/terminos_y_condiciones')
def terminos_y_condiciones():
    return render_template('terminos_y_condiciones.html')


@app.route('/<path:filename>')
def mostrar_pagina_estatica(filename):
    allowed_ext = ('.js', '.css', '.png', '.jpg', '.jpeg', '.svg', '.ico', '.html', '.json')
    if not any(filename.lower().endswith(ext) for ext in allowed_ext):
        abort(404)
    return send_from_directory(app.root_path, filename)


# SOLO para correr local
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)