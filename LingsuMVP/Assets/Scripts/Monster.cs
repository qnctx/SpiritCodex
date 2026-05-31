using UnityEngine;

namespace LingsuMVP
{
    public class Monster : MonoBehaviour
    {
        [Header("Monster Attributes")]
        public int hp = 30;
        public int maxHp = 30;
        public int attack = 5;
        public int defense = 2;
        public bool isBoss = false;

        private BattleManager _battleManager;
        private bool _isDead = false;

        public void Initialize(BattleManager battleManager, bool boss = false)
        {
            _battleManager = battleManager;
            isBoss = boss;
            maxHp = hp;
            _isDead = false;

            if (boss)
            {
                hp = 150;
                maxHp = 150;
                attack = 15;
                defense = 8;
            }
        }

        public void TakeDamage(int damage)
        {
            if (_isDead) return;

            int actualDamage = Mathf.Max(1, damage - defense);
            hp -= actualDamage;
            hp = Mathf.Max(0, hp);

            Debug.Log($"Monster{(isBoss ? " (BOSS)" : "")} took {actualDamage} damage. HP: {hp}/{maxHp}");

            if (hp <= 0)
            {
                Die();
            }
        }

        public void Attack(Hero target)
        {
            if (target != null && !_isDead)
            {
                int damage = attack;
                target.TakeDamage(damage);
                Debug.Log($"Monster{(isBoss ? " (BOSS)" : "")} attacks Hero for {damage} damage!");
            }
        }

        private void Die()
        {
            if (_isDead) return;
            _isDead = true;

            Debug.Log($"Monster{(isBoss ? " (BOSS)" : "")} died!");
            gameObject.SetActive(false);

            if (_battleManager != null)
            {
                _battleManager.OnMonsterDead(this, isBoss);
            }
        }

        public void ResetMonster()
        {
            _isDead = false;
            hp = isBoss ? 150 : 30;
            maxHp = hp;
            attack = isBoss ? 15 : 5;
            defense = isBoss ? 8 : 2;
            gameObject.SetActive(true);
        }
    }
}