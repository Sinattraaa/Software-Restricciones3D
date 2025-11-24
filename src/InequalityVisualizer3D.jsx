import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';

const InequalityVisualizer3D = () => {
  const mountRef = useRef(null);
  const [inequalities, setInequalities] = useState([
    { expr: 'x + y + z <= 10', color: '#ff6b6b', enabled: true },
    { expr: 'x >= 0', color: '#4ecdc4', enabled: true },
    { expr: 'y >= 0', color: '#45b7d1', enabled: true },
    { expr: 'z >= 0', color: '#96ceb4', enabled: true }
  ]);
  const [range, setRange] = useState({ min: 0, max: 15 });
  const [extremeCoordinates, setExtremeCoordinates] = useState([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [hoveredVertex, setHoveredVertex] = useState(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [objectiveFunction, setObjectiveFunction] = useState('x + y + z');
  const [optimizationType, setOptimizationType] = useState('max');
  const [optimalResult, setOptimalResult] = useState(null);
  const [showVertexDetails, setShowVertexDetails] = useState(false);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const extremesRef = useRef(null);
  const facesRef = useRef(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());

  const parseObjectiveFunction = (expr) => {
    try {
      const normalized = expr.replace(/,/g, '.').replace(/\s/g, '');
      let a = 0, b = 0, c = 0;
      
      const termRegex = /([+-]?)(\d*\.?\d*)?\*?([xyz])/g;
      let match;
      
      while ((match = termRegex.exec(normalized)) !== null) {
        const sign = match[1] === '-' ? -1 : 1;
        const coefficient = match[2] === '' || match[2] === undefined ? 1 : parseFloat(match[2]);
        const variable = match[3];
        const value = sign * coefficient;
        
        if (variable === 'x') a = value;
        else if (variable === 'y') b = value;
        else if (variable === 'z') c = value;
      }
      
      if (a === 0 && b === 0 && c === 0) {
        const terms = normalized.match(/[+-]?[^+-]+/g) || [];
        terms.forEach(term => {
          term = term.trim();
          if (term.includes('x')) {
            const coef = term.replace('x', '').replace('*', '').trim();
            a = coef === '' || coef === '+' ? 1 : coef === '-' ? -1 : parseFloat(coef);
          } else if (term.includes('y')) {
            const coef = term.replace('y', '').replace('*', '').trim();
            b = coef === '' || coef === '+' ? 1 : coef === '-' ? -1 : parseFloat(coef);
          } else if (term.includes('z')) {
            const coef = term.replace('z', '').replace('*', '').trim();
            c = coef === '' || coef === '+' ? 1 : coef === '-' ? -1 : parseFloat(coef);
          }
        });
      }
      
      return { a, b, c };
    } catch (e) {
      return null;
    }
  };

  const parseInequality = (expr) => {
    try {
      const normalized = expr
        .replace(/≤/g, '<=')
        .replace(/≥/g, '>=')
        .replace(/,/g, '.')
        .replace(/\s/g, '');
      
      let operator = '', parts = [];
      
      if (normalized.includes('<=')) { operator = '<='; parts = normalized.split('<='); }
      else if (normalized.includes('>=')) { operator = '>='; parts = normalized.split('>='); }
      else if (normalized.includes('<')) { operator = '<'; parts = normalized.split('<'); }
      else if (normalized.includes('>')) { operator = '>'; parts = normalized.split('>'); }
      else if (normalized.includes('=')) { operator = '='; parts = normalized.split('='); }
      else return null;
      
      const left = parts[0], right = parts[1];
      let a = 0, b = 0, c = 0, d = 0;
      
      try { d = parseFloat(eval(right)); } catch (e) { return null; }
      
      const termRegex = /([+-]?)(\d*\.?\d*)?\*?([xyz])/g;
      let match;
      
      while ((match = termRegex.exec(left)) !== null) {
        const sign = match[1] === '-' ? -1 : 1;
        const coefficient = match[2] === '' || match[2] === undefined ? 1 : parseFloat(match[2]);
        const variable = match[3];
        const value = sign * coefficient;
        
        if (variable === 'x') a = value;
        else if (variable === 'y') b = value;
        else if (variable === 'z') c = value;
      }
      
      if (a === 0 && b === 0 && c === 0) {
        const terms = left.match(/[+-]?[^+-]+/g) || [];
        terms.forEach(term => {
          term = term.trim();
          if (term.includes('x')) {
            const coef = term.replace('x', '').replace('*', '').trim();
            a = coef === '' || coef === '+' ? 1 : coef === '-' ? -1 : parseFloat(coef);
          } else if (term.includes('y')) {
            const coef = term.replace('y', '').replace('*', '').trim();
            b = coef === '' || coef === '+' ? 1 : coef === '-' ? -1 : parseFloat(coef);
          } else if (term.includes('z')) {
            const coef = term.replace('z', '').replace('*', '').trim();
            c = coef === '' || coef === '+' ? 1 : coef === '-' ? -1 : parseFloat(coef);
          }
        });
      }
      
      return { a, b, c, d, operator };
    } catch (e) { 
      return null; 
    }
  };

  const solveSystem3x3 = (eq1, eq2, eq3) => {
    const { a: a1, b: b1, c: c1, d: d1 } = eq1;
    const { a: a2, b: b2, c: c2, d: d2 } = eq2;
    const { a: a3, b: b3, c: c3, d: d3 } = eq3;
    
    const det = a1*(b2*c3 - b3*c2) - b1*(a2*c3 - a3*c2) + c1*(a2*b3 - a3*b2);
    if (Math.abs(det) < 0.0001) return null;
    
    const detX = d1*(b2*c3 - b3*c2) - b1*(d2*c3 - d3*c2) + c1*(d2*b3 - d3*b2);
    const detY = a1*(d2*c3 - d3*c2) - d1*(a2*c3 - a3*c2) + c1*(a2*d3 - a3*d2);
    const detZ = a1*(b2*d3 - b3*d2) - b1*(a2*d3 - a3*d2) + d1*(a2*b3 - a3*b2);
    
    return { x: detX / det, y: detY / det, z: detZ / det };
  };

  useEffect(() => {
    if (!mountRef.current) return;
    
    while (mountRef.current.firstChild) {
      mountRef.current.removeChild(mountRef.current.firstChild);
    }
    
    let maxValue = Math.max(Math.abs(range.min), Math.abs(range.max));
    inequalities.forEach(ineq => {
      if (ineq.enabled) {
        const parsed = parseInequality(ineq.expr);
        if (parsed && parsed.d) {
          maxValue = Math.max(maxValue, Math.abs(parsed.d) * 1.5);
        }
      }
    });
    
    const dynamicRange = Math.max(maxValue, 20);
    
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(75, mountRef.current.clientWidth / mountRef.current.clientHeight, 0.1, dynamicRange * 100);
    camera.position.set(dynamicRange * 0.8, dynamicRange * 0.8, dynamicRange * 0.8);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const axesHelper = new THREE.AxesHelper(dynamicRange * 1.5);
    scene.add(axesHelper);

    const gridHelper = new THREE.GridHelper(dynamicRange * 2, 20, 0xcccccc, 0xe0e0e0);
    scene.add(gridHelper);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(10, 10, 10);
    scene.add(directionalLight);

    const createAxisLabel = (text, position, color) => {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.width = 128;
      canvas.height = 128;
      context.fillStyle = color;
      context.font = 'Bold 80px Arial';
      context.textAlign = 'center';
      context.fillText(text, 64, 90);
      
      const texture = new THREE.CanvasTexture(canvas);
      const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
      const sprite = new THREE.Sprite(spriteMaterial);
      sprite.position.copy(position);
      sprite.scale.set(3, 3, 1);
      return sprite;
    };

    scene.add(createAxisLabel('X', new THREE.Vector3(dynamicRange * 1.3, 0, 0), '#ff0000'));
    scene.add(createAxisLabel('Y', new THREE.Vector3(0, dynamicRange * 1.3, 0), '#00aa00'));
    scene.add(createAxisLabel('Z', new THREE.Vector3(0, 0, dynamicRange * 1.3), '#0000ff'));

    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    let rotation = { x: 0, y: 0 };

    const onMouseDown = (e) => {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e) => {
      if (isDragging) {
        const deltaX = e.clientX - previousMousePosition.x;
        const deltaY = e.clientY - previousMousePosition.y;
        
        rotation.y += deltaX * 0.01;
        rotation.x += deltaY * 0.01;
        
        const radius = Math.sqrt(camera.position.x ** 2 + camera.position.y ** 2 + camera.position.z ** 2);
        camera.position.x = radius * Math.sin(rotation.y) * Math.cos(rotation.x);
        camera.position.y = radius * Math.sin(rotation.x);
        camera.position.z = radius * Math.cos(rotation.y) * Math.cos(rotation.x);
        camera.lookAt(0, 0, 0);
        
        previousMousePosition = { x: e.clientX, y: e.clientY };
      } else {
        const rect = renderer.domElement.getBoundingClientRect();
        mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        
        setMousePosition({ x: e.clientX, y: e.clientY });
        raycasterRef.current.setFromCamera(mouseRef.current, camera);
        
        if (extremesRef.current?.spheres) {
          const intersects = raycasterRef.current.intersectObjects(extremesRef.current.spheres);
          if (intersects.length > 0) {
            const sphere = intersects[0].object;
            const index = extremesRef.current.spheres.indexOf(sphere);
            if (index !== -1) {
              setHoveredVertex(index);
              renderer.domElement.style.cursor = 'pointer';
              return;
            }
          }
        }
        
        setHoveredVertex(null);
        renderer.domElement.style.cursor = 'grab';
      }
    };

    const onMouseUp = () => { isDragging = false; };

    const onWheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY * 0.05;
      const radius = Math.sqrt(camera.position.x ** 2 + camera.position.y ** 2 + camera.position.z ** 2);
      const newRadius = Math.max(5, Math.min(200, radius + delta));
      const scale = newRadius / radius;
      camera.position.multiplyScalar(scale);
    };

    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mouseup', onMouseUp);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

    const animate = () => {
      requestAnimationFrame(animate);
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        renderer.render(scene, camera);
      }
    };
    animate();

    const handleResize = () => {
      if (mountRef.current) {
        camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (renderer.domElement) {
        renderer.domElement.removeEventListener('mousedown', onMouseDown);
        renderer.domElement.removeEventListener('mousemove', onMouseMove);
        renderer.domElement.removeEventListener('mouseup', onMouseUp);
        renderer.domElement.removeEventListener('wheel', onWheel);
      }
      renderer.dispose();
      if (mountRef.current?.contains(renderer.domElement)) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, [range]);

  useEffect(() => {
    if (!sceneRef.current) return;
    setIsCalculating(true);

    const timeoutId = setTimeout(() => {
      if (extremesRef.current?.spheres) {
        extremesRef.current.spheres.forEach(sphere => {
          sceneRef.current.remove(sphere);
          sphere.geometry.dispose();
          sphere.material.dispose();
        });
      }

      if (facesRef.current) {
        facesRef.current.forEach(face => {
          sceneRef.current.remove(face);
          face.geometry?.dispose();
          face.material?.dispose();
        });
      }

      const enabledInequalities = inequalities.filter(ineq => ineq.enabled);
      if (enabledInequalities.length === 0) {
        setIsCalculating(false);
        setExtremeCoordinates([]);
        return;
      }

      const parsedInequalities = enabledInequalities.map(ineq => ({
        ...ineq,
        parsed: parseInequality(ineq.expr)
      })).filter(ineq => ineq.parsed !== null);

      if (parsedInequalities.length < 3) {
        setIsCalculating(false);
        setExtremeCoordinates([]);
        return;
      }

      const satisfiesAll = (x, y, z) => {
        const tolerance = 0.001;
        return parsedInequalities.every(ineq => {
          const { a, b, c, d, operator } = ineq.parsed;
          const value = a * x + b * y + c * z;
          
          switch(operator) {
            case '<=': return value <= d + tolerance;
            case '>=': return value >= d - tolerance;
            case '<': return value < d + tolerance;
            case '>': return value > d - tolerance;
            case '=': return Math.abs(value - d) < tolerance;
            default: return false;
          }
        });
      };
      
      const countPlanesThrough = (x, y, z) => {
        const tolerance = 0.001;
        return parsedInequalities.filter(ineq => {
          const { a, b, c, d } = ineq.parsed;
          const value = a * x + b * y + c * z;
          return Math.abs(value - d) < tolerance;
        }).length;
      };

      const vertices = [];
      const verticesSet = new Set();

      for (let i = 0; i < parsedInequalities.length; i++) {
        for (let j = i + 1; j < parsedInequalities.length; j++) {
          for (let k = j + 1; k < parsedInequalities.length; k++) {
            const solution = solveSystem3x3(
              parsedInequalities[i].parsed,
              parsedInequalities[j].parsed,
              parsedInequalities[k].parsed
            );
            
            if (solution) {
              const { x, y, z } = solution;
              
              if (x >= range.min - 0.001 && x <= range.max + 0.001 &&
                  y >= range.min - 0.001 && y <= range.max + 0.001 &&
                  z >= range.min - 0.001 && z <= range.max + 0.001) {
                
                if (satisfiesAll(x, y, z) && countPlanesThrough(x, y, z) >= 3) {
                  const key = `${x.toFixed(5)},${y.toFixed(5)},${z.toFixed(5)}`;
                  if (!verticesSet.has(key)) {
                    verticesSet.add(key);
                    vertices.push({ x, y, z });
                  }
                }
              }
            }
          }
        }
      }

      const boundaryPlanes = [
        { a: 1, b: 0, c: 0, d: range.min }, { a: 1, b: 0, c: 0, d: range.max },
        { a: 0, b: 1, c: 0, d: range.min }, { a: 0, b: 1, c: 0, d: range.max },
        { a: 0, b: 0, c: 1, d: range.min }, { a: 0, b: 0, c: 1, d: range.max }
      ];

      for (let i = 0; i < parsedInequalities.length; i++) {
        for (let j = i + 1; j < parsedInequalities.length; j++) {
          for (const boundPlane of boundaryPlanes) {
            const solution = solveSystem3x3(
              parsedInequalities[i].parsed,
              parsedInequalities[j].parsed,
              boundPlane
            );
            
            if (solution) {
              const { x, y, z } = solution;
              
              if (x >= range.min - 0.001 && x <= range.max + 0.001 &&
                  y >= range.min - 0.001 && y <= range.max + 0.001 &&
                  z >= range.min - 0.001 && z <= range.max + 0.001) {
                
                if (satisfiesAll(x, y, z) && countPlanesThrough(x, y, z) >= 3) {
                  const key = `${x.toFixed(5)},${y.toFixed(5)},${z.toFixed(5)}`;
                  if (!verticesSet.has(key)) {
                    verticesSet.add(key);
                    vertices.push({ x, y, z });
                  }
                }
              }
            }
          }
        }
      }

      if (vertices.length >= 4) {
        const coordsList = [];
        const spheres = [];

        vertices.forEach((vertex, index) => {
          const verificacion = parsedInequalities.map(ineq => {
            const { a, b, c, d, operator } = ineq.parsed;
            const value = a * vertex.x + b * vertex.y + c * vertex.z;
            const tolerance = 0.001;
            let cumple = false;
            
            switch(operator) {
              case '<=': cumple = value <= d + tolerance; break;
              case '>=': cumple = value >= d - tolerance; break;
              case '<': cumple = value < d + tolerance; break;
              case '>': cumple = value > d - tolerance; break;
              case '=': cumple = Math.abs(value - d) < tolerance; break;
              default: cumple = false;
            }
            
            return {
              expr: ineq.expr,
              value: value.toFixed(4),
              limite: d.toFixed(4),
              operator: operator,
              cumple: cumple
            };
          });
          
          const todasCumplen = verificacion.every(v => v.cumple);
          
          const sphereGeometry = new THREE.SphereGeometry(0.5, 32, 32);
          const sphereMaterial = new THREE.MeshPhongMaterial({
            color: todasCumplen ? 0x00ff00 : 0xff0000,
            emissive: todasCumplen ? 0x00ff00 : 0xff0000,
            emissiveIntensity: 0.3,
            shininess: 100
          });
          const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
          sphere.position.set(vertex.x, vertex.y, vertex.z);
          sphere.userData = { index, vertex };
          sceneRef.current.add(sphere);
          spheres.push(sphere);
          
          coordsList.push({
            id: index,
            x: vertex.x.toFixed(3),
            y: vertex.y.toFixed(3),
            z: vertex.z.toFixed(3),
            verificacion,
            todasCumplen
          });
        });
        
        extremesRef.current = { spheres };
        setExtremeCoordinates(coordsList);
        
        const objParsed = parseObjectiveFunction(objectiveFunction);
        if (objParsed) {
          const results = vertices.map((v, idx) => {
            const value = objParsed.a * v.x + objParsed.b * v.y + objParsed.c * v.z;
            return {
              vertex: v,
              index: idx,
              value: value,
              coords: coordsList[idx]
            };
          });
          
          let optimal;
          if (optimizationType === 'max') {
            optimal = results.reduce((max, curr) => curr.value > max.value ? curr : max, results[0]);
          } else {
            optimal = results.reduce((min, curr) => curr.value < min.value ? curr : min, results[0]);
          }
          
          setOptimalResult({
            type: optimizationType,
            vertex: optimal.vertex,
            value: optimal.value.toFixed(4),
            index: optimal.index,
            allResults: results
          });
          
          if (spheres[optimal.index]) {
            spheres[optimal.index].material.color.setHex(0xffff00);
            spheres[optimal.index].material.emissive.setHex(0xffff00);
            spheres[optimal.index].material.emissiveIntensity = 0.6;
            spheres[optimal.index].scale.set(1.5, 1.5, 1.5);
          }
        } else {
          setOptimalResult(null);
        }
        
        const vertices3D = vertices.map(v => new THREE.Vector3(v.x, v.y, v.z));
        const faces = [];
        const createdFaces = new Set();
        
        for (let i = 0; i < vertices3D.length; i++) {
          for (let j = i + 1; j < vertices3D.length; j++) {
            for (let k = j + 1; k < vertices3D.length; k++) {
              const v1 = vertices3D[i], v2 = vertices3D[j], v3 = vertices3D[k];
              
              const edge1 = new THREE.Vector3().subVectors(v2, v1);
              const edge2 = new THREE.Vector3().subVectors(v3, v1);
              const normal = new THREE.Vector3().crossVectors(edge1, edge2);
              
              if (normal.length() < 0.001) continue;
              
              normal.normalize();
              const d = -normal.dot(v1);
              
              let allOnOneSide = true, referenceSign = null;
              
              for (let m = 0; m < vertices3D.length; m++) {
                if (m === i || m === j || m === k) continue;
                
                const distance = normal.dot(vertices3D[m]) + d;
                
                if (Math.abs(distance) > 0.01) {
                  const sign = distance > 0 ? 1 : -1;
                  if (referenceSign === null) {
                    referenceSign = sign;
                  } else if (referenceSign !== sign) {
                    allOnOneSide = false;
                    break;
                  }
                }
              }
              
              if (allOnOneSide) {
                const faceId = [i, j, k].sort().join('-');
                if (createdFaces.has(faceId)) continue;
                createdFaces.add(faceId);
                
                const coplanarIndices = [i, j, k];
                for (let m = 0; m < vertices3D.length; m++) {
                  if (m === i || m === j || m === k) continue;
                  const distance = normal.dot(vertices3D[m]) + d;
                  if (Math.abs(distance) < 0.01) coplanarIndices.push(m);
                }
                
                if (coplanarIndices.length >= 3) {
                  const coplanarVerts = coplanarIndices.map(idx => vertices3D[idx]);
                  const center = new THREE.Vector3();
                  coplanarVerts.forEach(v => center.add(v));
                  center.divideScalar(coplanarVerts.length);
                  
                  const u = edge1.clone().normalize();
                  const v = new THREE.Vector3().crossVectors(normal, u).normalize();
                  
                  const points2D = coplanarVerts.map(vert => {
                    const offset = new THREE.Vector3().subVectors(vert, center);
                    return {
                      angle: Math.atan2(offset.dot(v), offset.dot(u)),
                      vertex: vert
                    };
                  });
                  
                  points2D.sort((a, b) => a.angle - b.angle);
                  
                  const faceVertices = [];
                  for (let m = 0; m < points2D.length; m++) {
                    const v1 = points2D[m].vertex;
                    const v2 = points2D[(m + 1) % points2D.length].vertex;
                    faceVertices.push(center.x, center.y, center.z, v1.x, v1.y, v1.z, v2.x, v2.y, v2.z);
                  }
                  
                  const faceGeometry = new THREE.BufferGeometry();
                  faceGeometry.setAttribute('position', new THREE.Float32BufferAttribute(faceVertices, 3));
                  faceGeometry.computeVertexNormals();
                  
                  const faceMaterial = new THREE.MeshPhongMaterial({
                    color: enabledInequalities[0].color,
                    transparent: true,
                    opacity: 0.6,
                    side: THREE.DoubleSide,
                    shininess: 80
                  });
                  
                  const faceMesh = new THREE.Mesh(faceGeometry, faceMaterial);
                  sceneRef.current.add(faceMesh);
                  faces.push(faceMesh);
                  
                  const edgeVertices = [];
                  for (let m = 0; m < points2D.length; m++) {
                    const v1 = points2D[m].vertex;
                    const v2 = points2D[(m + 1) % points2D.length].vertex;
                    edgeVertices.push(v1.x, v1.y, v1.z, v2.x, v2.y, v2.z);
                  }
                  
                  const edgesGeometry = new THREE.BufferGeometry();
                  edgesGeometry.setAttribute('position', new THREE.Float32BufferAttribute(edgeVertices, 3));
                  const edgesMaterial = new THREE.LineBasicMaterial({ 
                    color: 0xffffff, 
                    linewidth: 2, 
                    transparent: true, 
                    opacity: 0.9
                  });
                  const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
                  sceneRef.current.add(edges);
                  faces.push(edges);
                }
              }
            }
          }
        }
        
        facesRef.current = faces;
      } else {
        setExtremeCoordinates([]);
        setOptimalResult(null);
      }

      setIsCalculating(false);
    }, 50);

    return () => clearTimeout(timeoutId);
  }, [inequalities, range, objectiveFunction, optimizationType]);

  const addInequality = () => {
    setInequalities([...inequalities, { 
      expr: 'x + y + z <= 10', 
      color: '#' + Math.floor(Math.random()*16777215).toString(16),
      enabled: true 
    }]);
  };

  const updateInequality = (index, field, value) => {
    const newInequalities = [...inequalities];
    newInequalities[index][field] = value;
    setInequalities(newInequalities);
  };

  const removeInequality = (index) => {
    setInequalities(inequalities.filter((_, i) => i !== index));
  };

  const focusOnVertex = (vertex) => {
    if (!cameraRef.current) return;
    const camera = cameraRef.current;
    const offset = Math.max(5, Math.abs(vertex.x) + Math.abs(vertex.y) + Math.abs(vertex.z)) * 0.4;
    const newPos = new THREE.Vector3(vertex.x + offset, vertex.y + offset, vertex.z + offset);
    camera.position.copy(newPos);
    camera.lookAt(vertex.x, vertex.y, vertex.z);
  };

  return (
    <div className="w-full h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex relative overflow-hidden">
      {/* Sidebar */}
      <div className="w-96 bg-gradient-to-b from-gray-800 to-gray-900 border-r border-gray-700 shadow-2xl p-4 text-white flex-shrink-0 overflow-y-auto" 
           style={{ scrollbarWidth: 'thin', scrollbarColor: '#6366f1 #1f2937' }}>
        
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent mb-2">
            Gráfica 3D de Restricciones
          </h1>
          <div className="h-1 w-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full"></div>
        </div>
        
        {/* Función Objetivo */}
        <div className="mb-4 bg-gradient-to-br from-purple-900/30 to-blue-900/30 p-4 rounded-xl border border-purple-500/30 backdrop-blur-sm shadow-lg">
          <label className="text-sm font-semibold text-purple-300 mb-2 block flex items-center gap-2">
            <span className="text-lg">📊</span> Función Objetivo
          </label>
          <input 
            type="text" 
            value={objectiveFunction}
            onChange={(e) => setObjectiveFunction(e.target.value)}
            className="w-full px-3 py-2 bg-gray-900/50 rounded-lg text-white font-mono text-sm border border-purple-500/50 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent transition-all"
            placeholder="ej: 2*x + 3*y + z"
          />
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setOptimizationType('max')}
              className={`flex-1 px-3 py-2 rounded-lg font-semibold transition-all duration-200 ${
                optimizationType === 'max'
                  ? 'bg-gradient-to-r from-green-500 to-emerald-600 shadow-lg shadow-green-500/50 scale-105'
                  : 'bg-gray-700/50 hover:bg-gray-600/50 border border-gray-600'
              }`}
            >
              📈 Max
            </button>
            <button
              onClick={() => setOptimizationType('min')}
              className={`flex-1 px-3 py-2 rounded-lg font-semibold transition-all duration-200 ${
                optimizationType === 'min'
                  ? 'bg-gradient-to-r from-blue-500 to-cyan-600 shadow-lg shadow-blue-500/50 scale-105'
                  : 'bg-gray-700/50 hover:bg-gray-600/50 border border-gray-600'
              }`}
            >
              📉 Min
            </button>
          </div>
        </div>

        {/* Rango */}
        <div className="mb-4 bg-gradient-to-br from-gray-800/50 to-gray-900/50 p-4 rounded-xl border border-gray-600/50">
          <label className="text-sm font-semibold text-gray-300 mb-2 block flex items-center gap-2">
            <span className="text-lg">📏</span> Rango
          </label>
          <div className="grid grid-cols-2 gap-2">
            <input 
              type="number" 
              value={range.min} 
              onChange={(e) => setRange({...range, min: Number(e.target.value)})}
              className="px-3 py-2 bg-gray-900/50 rounded-lg text-white font-medium border border-gray-600/50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
              placeholder="Min"
            />
            <input 
              type="number" 
              value={range.max} 
              onChange={(e) => setRange({...range, max: Number(e.target.value)})}
              className="px-3 py-2 bg-gray-900/50 rounded-lg text-white font-medium border border-gray-600/50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
              placeholder="Max"
            />
          </div>
        </div>

        {/* Botón Agregar */}
        <button 
          onClick={addInequality}
          className="w-full px-4 py-3 mb-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-xl font-semibold shadow-lg shadow-blue-500/50 transform hover:scale-105 transition-all duration-200 flex items-center justify-center gap-2"
          disabled={isCalculating}
        >
          <span className="text-xl">➕</span> Agregar Restricción
        </button>

        {/* Lista de Restricciones */}
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
            <span className="text-lg">📐</span> Restricciones ({inequalities.length})
          </h2>
          <div className="space-y-2 max-h-80 overflow-y-auto pr-2" style={{ scrollbarWidth: 'thin', scrollbarColor: '#6366f1 #1f2937' }}>
            {inequalities.map((ineq, index) => (
              <div key={index} className="bg-gradient-to-r from-gray-800/80 to-gray-900/80 p-3 rounded-xl border border-gray-700/50 hover:border-gray-600 transition-all duration-200 shadow-md">
                <div className="flex gap-2 items-center">
                  <input 
                    type="checkbox" 
                    checked={ineq.enabled}
                    onChange={(e) => updateInequality(index, 'enabled', e.target.checked)}
                    className="w-5 h-5 accent-blue-500 cursor-pointer rounded"
                  />
                  <input 
                    type="color" 
                    value={ineq.color}
                    onChange={(e) => updateInequality(index, 'color', e.target.value)}
                    className="w-10 h-10 rounded-lg cursor-pointer border-2 border-gray-600 hover:border-gray-500 transition-all"
                  />
                  <input 
                    type="text" 
                    value={ineq.expr}
                    onChange={(e) => updateInequality(index, 'expr', e.target.value)}
                    className="flex-1 px-3 py-2 bg-gray-900/50 rounded-lg text-white font-mono text-sm border border-gray-600/50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
                    placeholder="ej: x + y <= 10"
                  />
                  <button 
                    onClick={() => removeInequality(index)}
                    className="px-3 py-2 bg-red-500/80 hover:bg-red-600 rounded-lg font-bold shadow-md transform hover:scale-110 transition-all duration-200"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Controles */}
        <div className="mb-4 bg-gradient-to-br from-gray-800/50 to-gray-900/50 p-4 rounded-xl border border-gray-600/50">
          <p className="font-semibold text-gray-300 text-sm mb-2 flex items-center gap-2">
            <span className="text-lg">💡</span> Controles
          </p>
          <div className="space-y-1 text-xs text-gray-400">
            <p>🖱️ Arrastra para rotar</p>
            <p>🔄 Scroll para zoom</p>
            <p>⚙️ Operadores: &lt;=, &gt;=, &lt;, &gt;, =</p>
            <p>🔢 Decimales: usa punto (.)</p>
          </div>
          {isCalculating && (
            <div className="mt-3 flex items-center gap-2 text-yellow-400">
              <div className="animate-spin">⏳</div>
              <span className="text-sm">Calculando...</span>
            </div>
          )}
        </div>

        {/* Resultado Óptimo */}
        {optimalResult && (
          <div className="mb-4 bg-gradient-to-br from-yellow-900/30 to-orange-900/30 p-4 rounded-xl border border-yellow-500/50 shadow-lg shadow-yellow-500/20">
            <p className="font-semibold text-yellow-300 text-sm mb-3 flex items-center gap-2">
              <span className="text-xl">🎯</span> Resultado Óptimo
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center bg-black/20 p-2 rounded">
                <span className="text-gray-300">Tipo:</span>
                <span className="font-bold text-yellow-300">{optimalResult.type === 'max' ? 'Máximo' : 'Mínimo'}</span>
              </div>
              <div className="flex justify-between items-center bg-black/20 p-2 rounded">
                <span className="text-gray-300">Valor:</span>
                <span className="font-bold text-green-400 text-lg">{optimalResult.value}</span>
              </div>
              <div className="flex justify-between items-center bg-black/20 p-2 rounded">
                <span className="text-gray-300">Vértice:</span>
                <span className="font-mono text-yellow-200 text-xs">
                  ({optimalResult.vertex.x.toFixed(2)}, {optimalResult.vertex.y.toFixed(2)}, {optimalResult.vertex.z.toFixed(2)})
                </span>
              </div>
            </div>
            <button
              onClick={() => focusOnVertex(optimalResult.vertex)}
              className="mt-3 w-full px-3 py-2 bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-gray-900 rounded-lg font-semibold text-sm shadow-lg transform hover:scale-105 transition-all duration-200"
            >
              🔎 Enfocar Vértice
            </button>
          </div>
        )}

        {/* Vértices */}
        {extremeCoordinates.length > 0 && (
          <div className="bg-gradient-to-br from-green-900/20 to-blue-900/20 p-4 rounded-xl border border-green-500/30">
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold text-green-300 text-sm flex items-center gap-2">
                <span className="text-xl">🌟</span> Vértices ({extremeCoordinates.length})
              </p>
              <button
                onClick={() => setShowVertexDetails(!showVertexDetails)}
                className="text-xs px-2 py-1 bg-gray-700/50 hover:bg-gray-600/50 rounded transition-all"
              >
                {showVertexDetails ? '▼' : '▶'}
              </button>
            </div>
            {showVertexDetails && (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-2" style={{ scrollbarWidth: 'thin', scrollbarColor: '#10b981 #1f2937' }}>
                {extremeCoordinates.map((coord, index) => (
                  <div key={index} className={`p-3 rounded-lg ${coord.todasCumplen ? 'bg-green-900/30 border border-green-500/30' : 'bg-red-900/30 border border-red-500/30'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-bold text-sm ${coord.todasCumplen ? 'text-green-400' : 'text-red-400'}`}>
                        {coord.todasCumplen ? '✓' : '✗'} V{index + 1}
                      </span>
                      <span className="text-white font-mono text-xs">
                        ({coord.x}, {coord.y}, {coord.z})
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Canvas 3D */}
      <div ref={mountRef} className="flex-1 relative">
        {/* Tooltip */}
        {hoveredVertex !== null && extremeCoordinates[hoveredVertex] && (
          <div 
            className="fixed pointer-events-none z-50 bg-gray-900/95 border-2 border-yellow-400 rounded-xl px-4 py-3 shadow-2xl max-w-sm backdrop-blur-sm"
            style={{
              left: `${Math.min(mousePosition.x + 15, window.innerWidth - 250)}px`,
              top: `${Math.min(mousePosition.y + 15, window.innerHeight - 200)}px`,
            }}
          >
            <div className={`font-bold text-sm mb-2 ${extremeCoordinates[hoveredVertex].todasCumplen ? 'text-green-400' : 'text-red-400'}`}>
              {extremeCoordinates[hoveredVertex].todasCumplen ? '✓' : '✗'} Vértice {hoveredVertex + 1}
            </div>
            <div className="text-white font-mono text-sm mb-2 bg-black/30 px-3 py-2 rounded">
              ({extremeCoordinates[hoveredVertex].x}, {extremeCoordinates[hoveredVertex].y}, {extremeCoordinates[hoveredVertex].z})
            </div>
            {extremeCoordinates[hoveredVertex].verificacion && (
              <div className="border-t border-gray-600 pt-2 mt-2 space-y-1">
                <div className="text-yellow-400 text-xs font-semibold mb-1">Verificación:</div>
                {extremeCoordinates[hoveredVertex].verificacion.slice(0, 3).map((v, i) => (
                  <div key={i} className={`text-xs ${v.cumple ? 'text-green-400' : 'text-red-400'}`}>
                    {v.cumple ? '✓' : '✗'} {v.expr}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default InequalityVisualizer3D;