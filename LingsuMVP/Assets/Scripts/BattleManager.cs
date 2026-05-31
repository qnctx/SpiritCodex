using UnityEngine;
using System.Collections.Generic;

namespace LingsuMVP
{
    public class BattleManager : MonoBehaviour
    {
        [Header("References")]
        public Hero hero;
        public List<Monster> monsters = new List<Monster>();
        public Monster bossPrefab;
        public Transform bossSpawnPoint;

        [Header("Attack Intervals")]
        public float heroAttackInterval = 1f;
        public float monsterAttackInterval = 1f;
        public float bossAttackInterval = 0.8f;

        private float _heroTimer = 0f;
        private float _monsterTimer = 0f;
        private float _bossTimer = 0f;
        private Monster _activeBoss;
        private bool _bossSpawned = false;
        private bool _battleActive = false;

        private void Update()
        {
            if (!_battleActive) return;

            _monsterTimer += Time.deltaTime;
            _heroTimer += Time.deltaTime;

            if (_monsterTimer >= monsterAttackInterval)
            {
                _monsterTimer = 0f;
                TriggerMonsterAttacks();
            }

            if (_heroTimer >= heroAttackInterval)
            {
                _heroTimer = 0f;
                TriggerHeroAttack();
            }

            if (_bossSpawned && _activeBoss != null && _activeBoss.gameObject.activeSelf)
            {
                _bossTimer += Time.deltaTime;
                if (_bossTimer >= bossAttackInterval)
                {
                    _bossTimer = 0f;
                    _activeBoss.Attack(hero);
                }
            }
        }

        private void TriggerMonsterAttacks()
        {
            foreach (Monster monster in monsters)
            {
                if (monster != null && monster.gameObject.activeSelf)
                {
                    monster.Attack(hero);
                }
            }
        }

        private void TriggerHeroAttack()
        {
            if (hero == null) return;

            // Attack the first active monster
            foreach (Monster monster in monsters)
            {
                if (monster != null && monster.gameObject.activeSelf)
                {
                    hero.Attack(monster);
                    return;
                }
            }

            // If no monsters, attack boss if exists
            if (_activeBoss != null && _activeBoss.gameObject.activeSelf)
            {
                hero.Attack(_activeBoss);
            }
        }

        public void StartBattle()
        {
            _battleActive = true;
            _heroTimer = 0f;
            _monsterTimer = 0f;
            _bossTimer = 0f;
        }

        public void StopBattle()
        {
            _battleActive = false;
        }

        public void OnMonsterDead(Monster monster, bool isBoss)
        {
            if (!isBoss)
            {
                // Check if all monsters are dead
                bool allMonstersDead = true;
                foreach (Monster m in monsters)
                {
                    if (m != null && m.gameObject.activeSelf)
                    {
                        allMonstersDead = false;
                        break;
                    }
                }

                if (allMonstersDead && !_bossSpawned)
                {
                    SpawnBoss();
                }
            }
        }

        private void SpawnBoss()
        {
            _bossSpawned = true;
            if (bossPrefab != null && bossSpawnPoint != null)
            {
                _activeBoss = Instantiate(bossPrefab, bossSpawnPoint.position, Quaternion.identity);
                _activeBoss.Initialize(this, true);
                Debug.Log("BOSS has appeared!");
            }
        }

        public void OnHeroDead()
        {
            StopBattle();
            if (GameManager.Instance != null)
            {
                GameManager.Instance.SetGameState(GameManager.GameState.Defeat);
            }
        }

        public void OnBossDead()
        {
            StopBattle();
            if (GameManager.Instance != null)
            {
                GameManager.Instance.SetGameState(GameManager.GameState.Victory);
            }
        }

        public void ResetBattle()
        {
            _battleActive = false;
            _bossSpawned = false;
            _heroTimer = 0f;
            _monsterTimer = 0f;
            _bossTimer = 0f;

            if (_activeBoss != null)
            {
                Destroy(_activeBoss.gameObject);
                _activeBoss = null;
            }
        }

        public void InitializeHero(Hero heroRef)
        {
            hero = heroRef;
            hero.Initialize(this);
        }

        public void AddMonster(Monster monster)
        {
            if (!monsters.Contains(monster))
            {
                monsters.Add(monster);
                monster.Initialize(this, false);
            }
        }
    }
}