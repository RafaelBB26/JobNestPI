document.addEventListener('DOMContentLoaded', function() {
    const navLinks = document.querySelectorAll('.navbar-nav .nav-link');
    const sections = document.querySelectorAll('header[id], section[id], footer[id]');
    const navbar = document.querySelector('.navbar');
    const navbarToggler = document.querySelector('.navbar-toggler'); //
    const navbarCollapse = document.getElementById('navbarNav'); //


    function removeActiveClass() {
        navLinks.forEach(link => {
            link.classList.remove('active');
        });
    }

    function addActiveClass(id) {
        const correspondingLink = document.querySelector(`.navbar-nav .nav-link[href="#${id}"]`);
        if (correspondingLink) {
            correspondingLink.classList.add('active');
        }
    }

    function onScroll() {
        let currentActiveSectionId = '';
        const scrollY = window.scrollY;
        const navbarHeight = navbar ? navbar.offsetHeight : 0;

        sections.forEach(section => {
            const sectionTop = section.offsetTop - navbarHeight - 30;
            const sectionBottom = sectionTop + section.offsetHeight;

            if (scrollY >= sectionTop && scrollY < sectionBottom) {
                currentActiveSectionId = section.id;
            }
        });

        removeActiveClass();
        if (currentActiveSectionId) {
            addActiveClass(currentActiveSectionId);
        } else {
            // si el scroll está antes de la primera sección, activa el enlace a hero-section
            if (sections[0] && scrollY < (sections[0].offsetTop - navbarHeight)) {
                addActiveClass('hero-section');
            }
        }
    }

    // llama onscroll inicialmente para establecer la clase activa en la carga
    onScroll();

    // añade el event listener para el scroll
    window.addEventListener('scroll', onScroll);

    // maneja el clic en los enlaces del navbar para un desplazamiento suave y cierra el navbar
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            // evita el comportamiento predeterminado solo si el enlace es a un ancla dentro de la misma página
            if (this.hash && this.pathname === window.location.pathname) {
                e.preventDefault();
                const targetId = this.hash;
                const targetSection = document.querySelector(targetId);
                if (targetSection) {
                    const offsetTop = targetSection.offsetTop - navbar.offsetHeight; // ajusta para la altura del navbar
                    window.scrollTo({
                        top: offsetTop,
                        behavior: 'smooth'
                    });

                    // cierra el navbar colapsable si está abierto
                    if (navbarCollapse.classList.contains('show')) {
                        navbarToggler.click(); // simula un clic en el botón de hamburguesa para cerrarlo
                    }
                }
            }
        });
    });
});

/*********** inicialización de swiper para la sección de empleos destacados ***********/
const swiperJobs = new Swiper(".mySwiperJobs", {
    slidesPerView: 1,
    spaceBetween: 30,
    loop: true,
    autoplay: {
        delay: 3500,
        disableOnInteraction: false,
    },
    breakpoints: {
        768: {
            slidesPerView: 2,
        },
        992: {
            slidesPerView: 3,
        },
    },
});

/*********** inicialización de swiper para la sección de testimonios ***********/
const swiperTestimonials = new Swiper(".mySwiperTestimonials", {
    slidesPerView: 1,
    spaceBetween: 30,
    loop: true,
    autoplay: {
        delay: 4000,
        disableOnInteraction: false,
    },
    breakpoints: {
        768: {
            slidesPerView: 2,
        },
        992: {
            slidesPerView: 3,
        },
    },
});