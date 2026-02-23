class ScrollVideoSection {
  constructor(section) {
    this.section = section;
    this.canvas = section.querySelector("canvas");
    this.ctx = this.canvas.getContext("2d");

    this.src = section.dataset.video;
    this.duration = Number(section.dataset.duration || 0);
    this.fps = Number(section.dataset.fps || 60);
    this.sampleEvery = Number(section.dataset.sample || 2);

    // ✅ intro only
    this.autoplaySeconds = Number(section.dataset.autoplay || 0);
    this.isIntro = this.autoplaySeconds > 0;

    this.totalFrames = Math.floor((this.duration * this.fps) / this.sampleEvery);

    this.frames = [];
    this.ready = false;

    this.resize = this.resize.bind(this);
    this.onScroll = this.onScroll.bind(this);

    this.init();
  }

  init() {
    this.resize();
    window.addEventListener("resize", this.resize);

    if (this.isIntro) {
      // ✅ INTRO mode = 2 videos (playback + extractor)
      this.videoPlayback = this.section.querySelector("video.playback");
      this.videoExtractor = this.section.querySelector("video.extractor");

      if (!this.videoPlayback || !this.videoExtractor) {
        console.error("Intro section needs 2 videos: .playback + .extractor");
        return;
      }

      this.setupVideo(this.videoPlayback);
      this.setupVideo(this.videoExtractor);

      this.videoPlayback.src = this.src;
      this.videoExtractor.src = this.src;

      this.videoPlayback.load();
      this.videoExtractor.load();

      this.videoExtractor.addEventListener("loadeddata", async () => {
        // ✅ extract frames first
        await this.extractFrames(this.videoExtractor);

        this.ready = true;

        // ✅ autoplay on canvas
        await this.playIntroOnCanvas(this.videoPlayback, this.autoplaySeconds);

        // ✅ enable scroll after autoplay
        this.onScroll();
        window.addEventListener("scroll", this.onScroll);
      });

    } else {
      // ✅ NORMAL mode = 1 video only
      this.video = this.section.querySelector("video");

      if (!this.video) {
        console.error("Normal scroll section needs 1 <video> tag");
        return;
      }

      this.setupVideo(this.video);

      this.video.src = this.src;
      this.video.load();

      this.video.addEventListener("loadeddata", async () => {
        await this.extractFrames(this.video);
        this.ready = true;
        this.drawFrame(0);

        window.addEventListener("scroll", this.onScroll);
      });
    }
  }
setupVideo(video) {
  video.crossOrigin = "anonymous";
  video.muted = true;
  video.playsInline = true;
  video.preload = "metadata"; // ✅ not auto
}

  resize() {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.canvas.style.width = "100vw";
    this.canvas.style.height = "100vh";
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  async playIntroOnCanvas(video, seconds) {
    try {
      await video.play();
    } catch (e) {
      console.log("Intro autoplay blocked");
      return;
    }

    const start = performance.now();

    return new Promise(resolve => {
      const draw = () => {
        const elapsed = (performance.now() - start) / 1000;

        this.ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        this.ctx.drawImage(video, 0, 0, window.innerWidth, window.innerHeight);

        if (elapsed >= seconds) {
          video.pause();
          resolve();
          return;
        }

        requestAnimationFrame(draw);
      };

      requestAnimationFrame(draw);
    });
  }

  async extractFrames(videoElement) {
    this.frames.length = 0;

    for (let i = 0; i < this.totalFrames; i++) {
      const t = (i * this.sampleEvery) / this.fps;

      await new Promise(resolve => {
        const onSeek = () => {
          videoElement.removeEventListener("seeked", onSeek);
          resolve();
        };
        videoElement.addEventListener("seeked", onSeek);
        videoElement.currentTime = t;
      });

      const bmp = await createImageBitmap(videoElement);
      this.frames.push(bmp);
    }
  }

  onScroll() {
    if (!this.ready) return;

    const scrollTop = window.scrollY;
    const sectionTop = this.section.offsetTop;
    const scrollLength = this.section.offsetHeight - window.innerHeight;

    const progress = Math.min(
      Math.max((scrollTop - sectionTop) / scrollLength, 0),
      1
    );

    // ✅ intro scroll starts after autoplay frame offset
    let startFrame = 0;
    if (this.isIntro) {
      startFrame = Math.floor((this.autoplaySeconds * this.fps) / this.sampleEvery);
      startFrame = Math.min(Math.max(startFrame, 0), this.frames.length - 1);
    }

    const remainingFrames = (this.frames.length - 1) - startFrame;
    const index = startFrame + Math.floor(progress * remainingFrames);

    this.drawFrame(index);
  }

  drawFrame(index) {
    const frame = this.frames[index];
    if (!frame) return;

    this.ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    this.ctx.drawImage(frame, 0, 0, window.innerWidth, window.innerHeight);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".scroll-video").forEach(section => {
    new ScrollVideoSection(section);
  });
});




document.addEventListener("DOMContentLoaded", () => {
  const reveals = document.querySelectorAll(".reveal");

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("active");
        } else {
          // Remove when out of view → so it can replay
          entry.target.classList.remove("active");
        }
      });
    },
    {
      threshold: 0.2 // 20% visible triggers animation
    }
  );

  reveals.forEach(el => observer.observe(el));
});




document.addEventListener("DOMContentLoaded", () => {
  const reveals = document.querySelectorAll(".reveal");

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("active");
      } else {
        entry.target.classList.remove("active"); // reset for replay
      }
    });
  }, {
    threshold: 0.25
  });

  reveals.forEach(el => observer.observe(el));
});


document.addEventListener("DOMContentLoaded", () => {
  const reveals = document.querySelectorAll(".reveal");

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("active");
      } else {
        entry.target.classList.remove("active"); // replay on scroll
      }
    });
  }, {
    threshold: 0.2
  });

  reveals.forEach(el => observer.observe(el));
});






document.addEventListener("DOMContentLoaded", () => {
  const staggerItems = document.querySelectorAll(".reveal-stagger");

  const staggerObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        staggerItems.forEach((item, index) => {
          setTimeout(() => {
            item.classList.add("active");
          }, index * 200); // delay between items
        });
      } else {
        // reset so it can replay
        staggerItems.forEach(item => item.classList.remove("active"));
      }
    });
  }, {
    threshold: 0.2
  });

  // Observe the section title as trigger
  const amenitiesSection = document.querySelector(".amenities-title");
  if (amenitiesSection) staggerObserver.observe(amenitiesSection);
});


document.addEventListener("DOMContentLoaded", () => {
  const title = document.querySelector(".intro-title");
  const subtitle = document.querySelector(".intro-sub");

  function splitText(el, delayStart = 0) {
    const text = el.innerText;
    el.innerHTML = "";

    text.split("").forEach((char, index) => {
      const span = document.createElement("span");
      span.textContent = char === " " ? "\u00A0" : char; // keep spaces
      span.style.animationDelay = `${delayStart + index * 0.08}s`;
      el.appendChild(span);
    });
  }

  // Split and animate
  splitText(title, 0);
  splitText(subtitle, 0.8); // subtitle starts after title
});
   document.addEventListener('DOMContentLoaded', () => {
            AOS.init({ duration: 1000, once: false });

            // 1. Background Scroll Logic
            const bgObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        document.body.style.backgroundColor = entry.target.getAttribute('data-bg');
                    }
                });
            }, { threshold: 0.4 });
            document.querySelectorAll('section[data-bg]').forEach(s => bgObserver.observe(s));

            // 2. Blur Reveal Logic
            const blurObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) entry.target.classList.add('active');
                });
            }, { threshold: 0.25 });
            const blurTarget = document.querySelector('.reveal-blur');
            if (blurTarget) blurObserver.observe(blurTarget);

            // 3. Simple Parallax Effect
            window.addEventListener('scroll', () => {
                const scrolled = window.pageYOffset;
                const parallaxImages = document.querySelectorAll('.parallax-img');
                parallaxImages.forEach(img => {
                    let speed = 0.15;
                    img.style.transform = `translateY(${scrolled * speed}px) scale(1.1)`;
                });
            });
        });


        // ===== 3D Parallax Hero Title =====
const hero = document.getElementById("hero3D");

document.addEventListener("mousemove", (e) => {
  const { innerWidth, innerHeight } = window;

  const x = (e.clientX / innerWidth - 0.5) * 20; // rotate range
  const y = (e.clientY / innerHeight - 0.5) * 20;

  hero.style.transform = `
    rotateY(${x}deg)
    rotateX(${-y}deg)
  `;
});

// Smooth return to center when mouse leaves
document.addEventListener("mouseleave", () => {
  hero.style.transform = "rotateX(0deg) rotateY(0deg)";
});
// ===== Scroll In / Out Toggle Animation =====
const toggleElements = document.querySelectorAll(".reveal-toggle");

const toggleObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add("is-visible");
    } else {
      entry.target.classList.remove("is-visible");
    }
  });
}, {
  threshold: 0.4
});
  // Split title into letters
  const title = document.getElementById("luxTitle");
  const text = title.innerText;
  title.innerHTML = "";

  text.split("").forEach((char, i) => {
    const span = document.createElement("span");
    span.textContent = char === " " ? "\u00A0" : char;
    span.style.animationDelay = `${i * 0.08}s`;
    title.appendChild(span);
  });

  // ===== SMART LOADER (MIN TIME + READY) =====
  document.addEventListener("DOMContentLoaded", () => {
    const loader = document.getElementById("site-loader");
    const MIN_TIME = 4000; // minimum 4s
    const start = performance.now();

    let ready = false;

    // Simple: wait for window load (you can keep your smart logic too)
    window.addEventListener("load", () => {
      ready = true;
      tryHide();
    });

    function tryHide() {
      const elapsed = performance.now() - start;
      const wait = Math.max(0, MIN_TIME - elapsed);

      setTimeout(() => {
        loader.classList.add("hide");
      }, wait + 400);
    }

    // Safety
    setTimeout(() => loader.classList.add("hide"), 20000);
  });