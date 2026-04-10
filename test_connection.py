import pyodbc

def test_connection_mac():
    DB_CONFIG = {
        'driver': '{ODBC Driver 18 for SQL Server}', 
        'server': 'localhost,1433',  
        'database': 'JobNest',
        'user': 'sa',  # Usuario por defecto de SQL Server en Docker
        'password': 'Cruzazul97.',  # Cambia por tu contraseña real
        'trust_server_certificate': 'yes'
    }
    
    try:
        connection_string = (
            f"DRIVER={DB_CONFIG['driver']};"
            f"SERVER={DB_CONFIG['server']};"
            f"DATABASE={DB_CONFIG['database']};"
            f"UID={DB_CONFIG['user']};"
            f"PWD={DB_CONFIG['password']};"
            f"TrustServerCertificate={DB_CONFIG['trust_server_certificate']};"
        )
        
        print("Cadena de conexión:", connection_string)
        
        conn = pyodbc.connect(connection_string)
        cursor = conn.cursor()
        
        print("✓ Conexión establecida exitosamente!")
        
        # Probar consultas
        cursor.execute("SELECT name FROM sys.databases")
        databases = cursor.fetchall()
        print("✓ Bases de datos disponibles:")
        for db in databases:
            print(f"  - {db[0]}")
        
        cursor.execute("SELECT COUNT(*) FROM Usuarios")
        user_count = cursor.fetchone()[0]
        print(f"✓ Total de usuarios en JobNest: {user_count}")
        
        conn.close()
        return True
        
    except pyodbc.Error as e:
        print(f"✗ Error de pyodbc: {e}")
        return False
    except Exception as e:
        print(f"✗ Error general: {e}")
        return False

if __name__ == "__main__":
    test_connection_mac()