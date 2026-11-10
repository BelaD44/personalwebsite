/*
 * Seed data for the demo. Everything here is MOCK data.
 * Course numbers/rooms are modeled on a Spring 2027 course schedule;
 * instructors, seat counts, restrictions and descriptions are invented.
 *
 * Meeting format: "DAYS H:MM-H:MM ROOM" using 24-hour times.
 * Day codes: M, T, W, TH, F (e.g. "MWF", "TTH").
 */
(function () {
  'use strict';

  const COURSE_INFO = {
    'M E 302': 'Fundamentals of engineering design, freehand sketching, and 3D solid modeling. Weekly studio plus a lecture on design communication.',
    'M E 314D': 'Kinematics and kinetics of particles and rigid bodies; work-energy and impulse-momentum methods with engineering applications.',
    'M E 316T': 'First and second laws of thermodynamics, properties of pure substances, cycles, and introductory energy-systems analysis.',
    'M E 318M': 'Programming in a high-level language, numerical methods, and computational problem solving for mechanical engineers.',
    'M E 330': 'Fluid statics, conservation laws for control volumes, dimensional analysis, pipe flow, and boundary-layer concepts.',
    'M E 334': 'Structure–property relationships in metals, polymers, ceramics, and composites; materials selection for design.',
    'M E 335': 'Probability, random variables, statistical inference, regression, and design of experiments for engineers.',
    'M E 337C': 'Introduction to nuclear energy systems, reactor physics fundamentals, and the nuclear fuel cycle.',
    'M E 338': 'Design and analysis of machine components: shafts, bearings, gears, fasteners, springs, and fatigue.',
    'M E 339': 'Conduction, convection, and radiation heat transfer; heat exchanger analysis and design.',
    'M E 340': 'Sensors, actuators, microcontrollers, and signal conditioning for electromechanical systems.',
    'M E 140L': 'Hands-on mechatronics laboratory: circuits, microcontroller programming, and sensor integration.',
    'M E 344': 'Modeling of dynamic systems, Laplace transforms, time and frequency response, and feedback control design.',
    'M E 353': 'Time value of money, cost estimation, project evaluation, and financial decision-making for engineers.',
    'M E 365D': 'Data wrangling, visualization, and introductory machine learning applied to engineering datasets.',
    'M E 366J': 'Structured design process: customer needs, functional modeling, concept generation, and selection.',
    'M E 374T': 'Solar, wind, hydro, and geothermal energy conversion; resource assessment and system economics.',
    'M E 379Q': 'Physics of musical instruments, sound perception, room acoustics, and acoustic measurement.',
    'M E 466E': 'Senior capstone: team-based design of a mechanical system for an industry or research sponsor.',
    'M E 397': 'Graduate topics in advanced fluid dynamics: viscous flow, turbulence, and computational methods.',
    'M 427J': 'First-order and linear differential equations, matrices, eigenvalues, and systems of ODEs.',
    'M 340L': 'Systems of linear equations, matrix algebra, determinants, vector spaces, and eigenvalues.',
    'M 362K': 'Axiomatic probability, discrete and continuous distributions, expectation, and limit theorems.',
    'PHY 303L': 'Electricity and magnetism for engineering and science students; circuits and electromagnetic waves.',
    'PHY 105N': 'Laboratory accompanying PHY 303L: measurements in electricity, magnetism, and optics.',
    'E M 319': 'Stress, strain, axial loading, torsion, bending, and deflection of beams; combined loading.',
    'C S 313E': 'Object-oriented design, data structures, and algorithm analysis in Python.',
    'C S 329E': 'Elements of data science: exploratory analysis, databases, and reproducible workflows.',
    'RHE 309K': 'Rhetoric and writing: argument analysis and research-based writing.'
  };

  // S(unique, dept, num, title, instructor, meetings[], capacity, enrolled, waitlistCap, waitlisted, extra)
  function S(unique, dept, num, title, instructor, meetings, capacity, enrolled, waitlistCap, waitlisted, extra) {
    return Object.assign({
      unique: String(unique), dept, num, title, instructor, meetings,
      capacity, enrolled, waitlistCap, waitlisted,
      cancelled: false, restriction: null, mode: 'Face-to-face'
    }, extra || {});
  }

  const SECTIONS = [
    // ---- Mechanical Engineering ----
    S(19185, 'M E', '302', 'Intro to Engr Design & Graphics', 'Dr. Maya Okafor', ['MW 8:00-10:00 ETC 3.142', 'M 15:00-16:00 GEA 105'], 30, 22, 10, 0),
    S(19200, 'M E', '302', 'Intro to Engr Design & Graphics', 'Dr. Maya Okafor', ['TTH 8:00-10:00 ETC 3.142', 'W 15:00-16:00 GEA 105'], 30, 30, 10, 2),
    S(19250, 'M E', '314D', 'Dynamics', 'Prof. Daniel Whitcomb', ['MWF 9:00-10:00 GSB 2.124', 'F 10:00-11:00 ETC 7.146'], 45, 38, 10, 0),
    S(19275, 'M E', '314D', 'Dynamics', 'Dr. Priya Raman', ['TTH 12:30-14:00 EER 1.528', 'F 9:00-10:00 ETC 2.140'], 45, 41, 10, 0),
    S(19300, 'M E', '316T', 'Thermodynamics', 'Prof. Luis Herrera', ['MWF 9:00-10:00 EER 1.504', 'W 17:00-18:00 ETC 5.132'], 50, 44, 10, 0),
    S(19310, 'M E', '316T', 'Thermodynamics', 'Prof. Luis Herrera', ['MWF 11:00-12:00 ETC 2.108', 'W 16:00-17:00 ETC 4.150'], 50, 35, 10, 0),
    S(19330, 'M E', '318M', 'Programming & Engr Comp Methods', 'Dr. Hannah Lindqvist', ['TTH 11:00-12:30 ETC 2.114'], 60, 52, 15, 0),
    S(19400, 'M E', '330', 'Fluid Mechanics', 'Dr. Samuel Achebe', ['MWF 10:00-11:00 ETC 2.136'], 40, 26, 10, 0),
    S(19405, 'M E', '330', 'Fluid Mechanics', 'Dr. Samuel Achebe', ['TTH 14:00-15:30 ETC 2.136'], 40, 40, 10, 4),
    S(19420, 'M E', '334', 'Materials Engineering', 'Prof. Grace Thornton', ['TTH 9:30-11:00 ETC 2.108'], 55, 49, 10, 0),
    S(19440, 'M E', '335', 'Engineering Statistics', 'Dr. Kevin Nakamura', ['TTH 9:30-11:00 ETC 2.102'], 50, 47, 10, 0),
    S(19445, 'M E', '335', 'Engineering Statistics', 'Dr. Kevin Nakamura', ['MWF 13:00-14:00 ETC 2.102'], 50, 31, 10, 0),
    S(19450, 'M E', '335', 'Engineering Statistics', 'Dr. Olivia Brandt', ['MW 15:30-17:00 ETC 2.102'], 50, 50, 10, 6),
    S(19470, 'M E', '337C', 'Intro to Nuclear Systems', 'Dr. Tomas Novak', ['TTH 9:30-11:00 ETC 5.116'], 35, 0, 0, 0, { cancelled: true }),
    S(19480, 'M E', '338', 'Machine Elements', 'Prof. Rebecca Saldana', ['MWF 12:00-13:00 ETC 2.136'], 45, 30, 10, 0),
    S(19500, 'M E', '339', 'Heat Transfer', 'Dr. Ahmed Farouk', ['TTH 12:30-14:00 ETC 2.108'], 48, 48, 10, 9),
    S(19505, 'M E', '339', 'Heat Transfer', 'Dr. Ahmed Farouk', ['MWF 14:00-15:00 ETC 2.108'], 48, 40, 10, 0),
    S(19520, 'M E', '344', 'Dynamic Systems & Controls', 'Prof. Daniel Whitcomb', ['MWF 11:00-12:00 ETC 2.114'], 40, 40, 15, 3),
    S(19525, 'M E', '344', 'Dynamic Systems & Controls', 'Dr. Priya Raman', ['TTH 15:30-17:00 ETC 2.114'], 40, 33, 15, 0),
    S(19540, 'M E', '340', 'Mechatronics', 'Dr. Hannah Lindqvist', ['TTH 8:00-9:30 ETC 4.150'], 36, 30, 10, 0),
    S(19141, 'M E', '140L', 'Mechatronics Laboratory', 'Dr. Hannah Lindqvist', ['W 18:00-21:00 ETC 4.150'], 24, 20, 5, 0),
    S(19560, 'M E', '353', 'Engineering Finance', 'Prof. Martin Keller', ['TTH 17:00-18:30 UTC 3.112'], 60, 20, 10, 0),
    S(19580, 'M E', '365D', 'Data Science for Engineers', 'Dr. Olivia Brandt', ['MW 17:00-18:30 ETC 2.136'], 35, 35, 10, 10),
    S(19600, 'M E', '366J', 'Mech Engr Design Methodology', 'Prof. Rebecca Saldana', ['TTH 11:00-12:30 ETC 3.142'], 40, 18, 10, 0),
    S(19620, 'M E', '374T', 'Renewable Energy Technology', 'Dr. Ingrid Solberg', ['TTH 14:00-15:30 ETC 5.132'], 40, 12, 10, 0),
    S(19640, 'M E', '379Q', 'Musical Acoustics', 'Dr. Felix Moreau', ['F 13:00-16:00 ETC 7.111'], 30, 25, 5, 0),
    S(19660, 'M E', '466E', 'Mechanical Engr Capstone Design', 'Prof. Martin Keller', ['MW 13:00-15:00 ETC 3.142'], 60, 20, 10, 0,
      { restriction: { type: 'standing', min: 'Senior', text: 'Senior standing required' } }),
    S(19800, 'M E', '397', 'Advanced Fluid Dynamics', 'Dr. Samuel Achebe', ['TTH 15:30-17:00 ETC 7.146'], 25, 14, 5, 0,
      { restriction: { type: 'standing', min: 'Graduate', text: 'Graduate students only' } }),

    // ---- Engineering Mechanics ----
    S(13400, 'E M', '319', 'Mechanics of Solids', 'Prof. Grace Thornton', ['TTH 11:00-12:30 ECJ 1.202'], 60, 58, 10, 0),
    S(13410, 'E M', '319', 'Mechanics of Solids', 'Dr. Tomas Novak', ['MWF 15:00-16:00 ECJ 1.202'], 60, 20, 10, 0),

    // ---- Mathematics ----
    S(53500, 'M', '427J', 'Differential Equations w/ Linear Algebra', 'Dr. Elena Vasquez', ['MWF 8:00-9:00 RLP 0.112', 'TH 8:00-9:00 RLP 0.112'], 45, 33, 10, 0),
    S(53520, 'M', '427J', 'Differential Equations w/ Linear Algebra', 'Dr. Elena Vasquez', ['TTH 12:30-14:00 RLP 1.106', 'W 16:00-17:00 RLP 1.106'], 45, 45, 10, 1),
    S(53600, 'M', '340L', 'Matrices & Matrix Calculations', 'Prof. Noah Feldman', ['MWF 10:00-11:00 PMA 5.108'], 45, 30, 10, 0),
    S(53640, 'M', '362K', 'Probability I', 'Prof. Noah Feldman', ['TTH 11:00-12:30 PMA 6.104'], 45, 44, 10, 0),
    S(53645, 'M', '362K', 'Probability I', 'Dr. Aisha Grant', ['MWF 14:00-15:00 PMA 6.104'], 45, 0, 0, 0, { cancelled: true }),

    // ---- Physics ----
    S(56100, 'PHY', '303L', 'Engineering Physics II', 'Dr. Owen Mercer', ['MWF 12:00-13:00 WEL 2.224'], 120, 95, 20, 0),
    S(56120, 'PHY', '303L', 'Engineering Physics II', 'Dr. Owen Mercer', ['TTH 15:30-17:00 WEL 2.224'], 120, 60, 20, 0),
    S(56140, 'PHY', '105N', 'Laboratory for PHY 303L', 'Dr. Lena Fischer', ['W 14:00-17:00 PMA 7.110'], 24, 24, 5, 1),

    // ---- Computer Science ----
    S(51000, 'C S', '313E', 'Elements of Software Design', 'Dr. Ravi Menon', ['MWF 13:00-14:00 GDC 2.216'], 80, 70, 15, 0,
      { restriction: { type: 'major', major: 'C S', text: 'Restricted to C S majors' } }),
    S(51020, 'C S', '329E', 'Elements of Data Science', 'Dr. Ravi Menon', ['MW 17:00-18:30 GDC 1.304'], 60, 41, 10, 0),

    // ---- Rhetoric ----
    S(43010, 'RHE', '309K', 'Rhetoric and Writing', 'Dr. Claire Donovan', ['MWF 15:00-16:00 PAR 304'], 25, 19, 5, 0)
  ];

  SECTIONS.forEach(s => { s.description = COURSE_INFO[s.dept + ' ' + s.num] || 'Course description not available in the demo catalog.'; });

  window.SEED = {
    version: 3,
    term: { name: 'Spring 2027', start: '2027-01-11', end: '2027-04-26' },
    // Simulated registration window
    windowOpensAt: '2026-11-12T08:00:00',
    clockStart: '2026-11-11T09:00:00',
    student: { name: 'Alex Rivera', eid: 'demo123', major: 'M E', standing: 'Junior', hoursCompleted: 74 },
    defaultCreditLimit: 17,
    sections: SECTIONS,
    registered: ['19440'],
    schedules: [
      { id: 'sch-a', name: 'Plan A – Conflict demo', sections: ['19250', '19300', '19400', '19480'] },
      { id: 'sch-b', name: 'Plan B – Ambitious (has a full class)', sections: ['19500', '19310', '19400', '19620'] },
      { id: 'sch-c', name: 'Plan C – Safe backup', sections: ['19505', '19310', '19400', '19620'] }
    ]
  };
})();
