class ScrollVideoSection {
  constructor(section) {
    // iOS detection
    this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                 (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    
    this.section = section;
    this.canvas = section.querySelector("canvas");
    this.ctx = this.canvas.getContext("2d");

    this.src = section.dataset.video;
    this.duration = Number(section.dataset.duration || 0);
    this.fps = Number(section.dataset.fps || 30); // Reduced to 30fps for better performance
    this.sampleEvery = Number(section.dataset.sample || 4); // Sample fewer frames
    
    // For iOS, further reduce quality
    if (this.isIOS) {
      this.sampleEvery = 6; // Sample even fewer frames on iOS
    }

    this.autoplaySeconds = Number(section.dataset.autoplay || 0);
    this.isIntro = this.autoplaySeconds > 0;

    this.totalFrames = Math.floor((this.duration * this.fps) / this.sampleEvery);
    
    // Limit total frames for iOS
    if (this.isIOS && this.totalFrames > 60) {
      this.totalFrames = 60;
    }

    this.frames = [];
    this.ready = false;
    this.fallbackMode = false;

    this.resize = this.resize.bind(this);
    this.onScroll = this.onScroll.bind(this);

    this.init();
  }

  async init() {
    this.resize();
    window.addEventListener("resize", this.resize);

    if (this.isIntro) {
      this.videoPlayback = this.section.querySelector("video.playback");
      this.videoExtractor = this.section.querySelector("video.extractor");

      if (!this.videoPlayback || !this.videoExtractor) {
        console.error("Intro section needs 2 videos");
        return;
      }

      this.setupVideo(this.videoPlayback);
      this.setupVideo(this.videoExtractor);

      this.videoPlayback.src = this.src;
      this.videoExtractor.src = this.src;

      try {
        // Wait for videos to be ready
        await Promise.all([
          this.waitForVideo(this.videoPlayback),
          this.waitForVideo(this.videoExtractor)
        ]);

        // Try to extract frames
        const extractSuccess = await this.extractFrames(this.videoExtractor);
        
        if (extractSuccess) {
          this.ready = true;
          
          // For iOS, skip autoplay and just show first frame
          if (this.isIOS) {
            this.drawFrame(0);
          } else {
            await this.playIntroOnCanvas(this.videoPlayback, this.autoplaySeconds);
          }
        } else {
          // Fallback to video playback
          this.enableFallbackMode();
        }

        this.onScroll();
        window.addEventListener("scroll", this.onScroll);
        
      } catch (e) {
        console.error("Video initialization failed:", e);
        this.enableFallbackMode();
      }

    } else {
      this.video = this.section.querySelector("video");

      if (!this.video) {
        console.error("Normal scroll section needs 1 <video> tag");
        return;
      }

      this.setupVideo(this.video);
      this.video.src = this.src;

      try {
        await this.waitForVideo(this.video);
        
        const extractSuccess = await this.extractFrames(this.video);
        
        if (extractSuccess) {
          this.ready = true;
          this.drawFrame(0);
        } else {
          this.enableFallbackMode();
        }

        window.addEventListener("scroll", this.onScroll);
        
      } catch (e) {
        console.error("Video initialization failed:", e);
        this.enableFallbackMode();
      }
    }
  }

  setupVideo(video) {
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto"; // Changed to "auto" for better loading
    
    if (this.isIOS) {
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');
    }
  }

  waitForVideo(video) {
    return new Promise((resolve, reject) => {
      if (video.readyState >= 2) {
        resolve();
      } else {
        const timeout = setTimeout(() => {
          reject(new Error('Video load timeout'));
        }, 10000);

        video.addEventListener('loadeddata', () => {
          clearTimeout(timeout);
          resolve();
        }, { once: true });

        video.addEventListener('error', () => {
          clearTimeout(timeout);
          reject(new Error('Video failed to load'));
        }, { once: true });
      }
    });
  }

  enableFallbackMode() {
    console.log("Enabling fallback mode for section");
    this.fallbackMode = true;
    this.ready = true;
    
    // Hide canvas, show video
    if (this.canvas) {
      this.canvas.style.display = "none";
    }
    
    const video = this.isIntro ? this.videoPlayback : this.video;
    if (video) {
      video.style.display = "block";
      video.style.position = "absolute";
      video.style.top = "0";
      video.style.left = "0";
      video.style.width = "100%";
      video.style.height = "100%";
      video.style.objectFit = "cover";
      
      // Ensure video plays
      video.play().catch(e => console.log("Video play failed:", e));
    }
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

        if (elapsed >= seconds || video.paused || video.ended) {
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
    
    // If on iOS and video is large, skip frame extraction
    if (this.isIOS && this.totalFrames > 30) {
      console.log("Skipping frame extraction on iOS");
      return false;
    }
    
    // Limit frames for mobile
    const maxFrames = this.isIOS ? 40 : 80;
    const frameStep = Math.max(1, Math.ceil(this.totalFrames / maxFrames));
    
    let successCount = 0;
    
    for (let i = 0; i < this.totalFrames; i += frameStep) {
      const t = (i * this.sampleEvery) / this.fps;
      
      try {
        // Seek with timeout
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Seek timeout')), 2000);
          
          const onSeek = () => {
            clearTimeout(timeout);
            videoElement.removeEventListener("seeked", onSeek);
            resolve();
          };
          
          videoElement.addEventListener("seeked", onSeek, { once: true });
          videoElement.currentTime = t;
        });

        // Create bitmap with size limit
        let bmp;
        try {
          if (this.isIOS) {
            // On iOS, use a smaller canvas to reduce memory
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = 640;
            tempCanvas.height = 360;
            tempCanvas.getContext('2d').drawImage(videoElement, 0, 0, 640, 360);
            bmp = await createImageBitmap(tempCanvas);
          } else {
            bmp = await createImageBitmap(videoElement);
          }
          
          this.frames.push(bmp);
          successCount++;
          
        } catch (e) {
          console.warn(`Frame ${i} bitmap creation failed:`, e);
        }
        
        // Allow browser to breathe
        if (i % 10 === 0) {
          await new Promise(r => setTimeout(r, 10));
        }
        
      } catch (e) {
        console.warn(`Frame ${i} extraction failed:`, e);
      }
    }
    
    return successCount > 0;
  }

  onScroll() {
    if (!this.ready) return;

    // Fallback mode - use video currentTime
    if (this.fallbackMode) {
      const video = this.isIntro ? this.videoPlayback : this.video;
      if (!video) return;
      
      const scrollTop = window.scrollY;
      const sectionTop = this.section.offsetTop;
      const scrollLength = this.section.offsetHeight - window.innerHeight;
      
      const progress = Math.min(
        Math.max((scrollTop - sectionTop) / scrollLength, 0),
        1
      );
      
      video.currentTime = progress * this.duration;
      return;
    }

    // Normal mode - use frames
    if (this.frames.length === 0) return;

    const scrollTop = window.scrollY;
    const sectionTop = this.section.offsetTop;
    const scrollLength = this.section.offsetHeight - window.innerHeight;

    let progress = Math.min(
      Math.max((scrollTop - sectionTop) / scrollLength, 0),
      1
    );

    if (this.isIntro) {
      const startFrame = Math.floor((this.autoplaySeconds * this.fps) / this.sampleEvery);
      const adjustedStart = Math.min(Math.max(startFrame, 0), this.frames.length - 1);
      
      if (this.frames.length > adjustedStart) {
        const remainingFrames = this.frames.length - 1 - adjustedStart;
        const index = adjustedStart + Math.floor(progress * remainingFrames);
        this.drawFrame(Math.min(index, this.frames.length - 1));
      }
    } else {
      const index = Math.floor(progress * (this.frames.length - 1));
      this.drawFrame(Math.min(index, this.frames.length - 1));
    }
  }

  drawFrame(index) {
    const frame = this.frames[index];
    if (!frame) return;

    try {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.drawImage(frame, 0, 0, this.canvas.width, this.canvas.height);
    } catch (e) {
      console.warn('Draw error:', e);
    }
  }
}

// Initialize everything when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  // Add iOS class to body
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
    document.body.classList.add('ios-device');
  }
  
  // Initialize video sections
  document.querySelectorAll(".scroll-video").forEach(section => {
    new ScrollVideoSection(section);
  });

  // Intersection Observer for reveal elements
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("active", "is-visible");
      } else {
        entry.target.classList.remove("active", "is-visible");
      }
    });
  }, {
    threshold: 0.2
  });

  // Observe all reveal elements
  document.querySelectorAll(".reveal, .reveal-toggle, .reveal-stagger").forEach(el => {
    observer.observe(el);
  });

  // Stagger animation for amenities
  const staggerObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const items = document.querySelectorAll(".feature-card");
        items.forEach((item, index) => {
          setTimeout(() => {
            item.classList.add("active");
          }, index * 100);
        });
      }
    });
  }, {
    threshold: 0.2
  });

  const amenitiesSection = document.querySelector(".amenities-section");
  if (amenitiesSection) staggerObserver.observe(amenitiesSection);

  // Split text animation for intro
  const title = document.querySelector(".intro-title");
  if (title) {
    const text = title.innerText;
    title.innerHTML = "";
    text.split("").forEach((char, index) => {
      const span = document.createElement("span");
      span.textContent = char === " " ? "\u00A0" : char;
      span.style.animationDelay = `${index * 0.05}s`;
      title.appendChild(span);
    });
  }

  // AOS initialization
  if (typeof AOS !== 'undefined') {
    AOS.init({ 
      duration: 1000, 
      once: false 
    });
  }

  // 3D Parallax Hero Title
  const hero = document.getElementById("hero3D");
  if (hero) {
    document.addEventListener("mousemove", (e) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 10;
      const y = (e.clientY / window.innerHeight - 0.5) * 10;
      hero.style.transform = `rotateY(${x}deg) rotateX(${-y}deg)`;
    });

    document.addEventListener("mouseleave", () => {
      hero.style.transform = "rotateX(0deg) rotateY(0deg)";
    });
  }

  // Loader handling
  const loader = document.getElementById("site-loader");
  const curtain = document.getElementById("curtain");
  
  if (loader) {
    const MIN_TIME = 2000; // Reduced to 2 seconds
    const start = Date.now();

    window.addEventListener("load", () => {
      const elapsed = Date.now() - start;
      const wait = Math.max(0, MIN_TIME - elapsed);

      setTimeout(() => {
        loader.classList.add("exiting");
        
        setTimeout(() => {
          loader.style.display = "none";
          if (curtain) {
            curtain.classList.add("open");
          }
        }, 1000);
      }, wait);
    });

    // Safety fallback
    setTimeout(() => {
      if (loader.style.display !== "none") {
        loader.classList.add("exiting");
        setTimeout(() => {
          loader.style.display = "none";
          if (curtain) {
            curtain.classList.add("open");
          }
        }, 1000);
      }
    }, 5000);
  }
});

// Handle visibility change to save memory
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    // Page hidden, pause any heavy operations
    document.querySelectorAll("video").forEach(video => {
      if (!video.paused) video.pause();
    });
  }
});